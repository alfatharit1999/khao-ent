/**
 * ข้าว ENT — Google Sheets backup & rollback database
 * ====================================================
 * Pulls live data from Supabase (read-only public key) into this spreadsheet.
 * Two jobs:
 *   1. 2-WEEK ORDER GRID ("สัปดาห์นี้") — auto-updated from the app. It MERGES:
 *      where the app has an order it wins; where the app has nothing, whatever
 *      is already in the cell is kept — so a hand-typed order is never replaced
 *      with a blank. The grid resets when a new 2-week window starts.
 *   2. ROLLBACK DATABASE — append-only log tabs that never erase: every order,
 *      who paid each day, the full credit ledger, a daily credit snapshot, and
 *      a copy of each finished 2-week grid ("ประวัติตาราง"). If the app ever
 *      bugs out you can see the exact state at any past time.
 *
 * It only READS from Supabase and only writes to its OWN tabs — your existing
 * sheets are never touched.
 *
 * ONE-TIME SETUP
 *   1. Extensions → Apps Script. Paste this whole file. Save.
 *   2. Function dropdown → `setup` → Run. Approve permissions.
 *   3. Done. Schedule (Asia/Bangkok, ±15 min):
 *        • Order grid: midnight, 08:00, 09:00, 09:30.
 *        • Money & history: 13:00 and 21:00.
 *
 * Manual refresh any time: run `syncNow`.
 */

const SUPABASE_URL = "https://qfruxadnsxvmhojdgciv.supabase.co";
// Public publishable/anon key — read-only via RLS, same key the web app ships.
const SUPABASE_KEY = "sb_publishable_HvCLw8bEjdnrtsFjkc5skw_ghEy3cq5";
const TZ = "Asia/Bangkok";
const LOG_DAYS = 60; // how many recent days of orders/credits to keep in sync

const DOW_TH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function setup() {
  removeOldEmergencyTab_();
  syncNow(); // build everything immediately

  // Clear any triggers we created before, then set the schedule fresh.
  const mine = ["syncNow", "syncWeekTab", "syncLogs", "midnightSync", "morningSync", "ordersSync", "recordsSync"];
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (mine.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });

  // Orders grid — midnight, 08:00, 09:00, 09:30. Merge-updates (never blanks
  // out a cell that someone typed by hand).
  ScriptApp.newTrigger("ordersSync").timeBased().atHour(0).nearMinute(5).everyDays(1).create();
  ScriptApp.newTrigger("ordersSync").timeBased().atHour(8).nearMinute(0).everyDays(1).create();
  ScriptApp.newTrigger("ordersSync").timeBased().atHour(9).nearMinute(0).everyDays(1).create();
  ScriptApp.newTrigger("ordersSync").timeBased().atHour(9).nearMinute(30).everyDays(1).create();

  // Money & history — twice a day only (after lunch + evening), light load.
  ScriptApp.newTrigger("recordsSync").timeBased().atHour(13).nearMinute(0).everyDays(1).create();
  ScriptApp.newTrigger("recordsSync").timeBased().atHour(21).nearMinute(0).everyDays(1).create();

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "ตั้งค่าเรียบร้อย ✓ ออเดอร์: เที่ยงคืน/8:00/9:00/9:30 · เงิน: 13:00/21:00",
  );
}

/** Manual "refresh everything now" — also used by setup. */
function syncNow() {
  syncWeek_();
  recordsSync();
}

/** Orders grid (midnight/8:00/9:00/9:30). */
function ordersSync() {
  syncWeek_();
}

/** Money & history (twice a day). */
function recordsSync() {
  logOrders_();        // DB: every order (append-only)
  logClaims_();        // DB: who paid each day (append-only)
  logCredits_();       // DB: full credit ledger (append-only)
  snapshotBalances_(); // DB: daily credit snapshot per person (rollback)
  syncFund_();         // กองกลาง ledger
}

// ---- helpers ---------------------------------------------------------------

function api_(path) {
  const res = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/" + path, {
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) throw new Error(res.getContentText());
  return JSON.parse(res.getContentText());
}

function ymd_(d) { return Utilities.formatDate(d, TZ, "yyyy-MM-dd"); }
function hhmm_() { return Utilities.formatDate(new Date(), TZ, "HH:mm"); }
function sinceYmd_() { const d = new Date(); d.setDate(d.getDate() - LOG_DAYS); return ymd_(d); }

// Today's calendar date in Bangkok, as a plain local Date (for weekday math).
function todayParts_() {
  const s = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd").split("-");
  return new Date(Number(s[0]), Number(s[1]) - 1, Number(s[2]));
}
function fmtLocal_(d) {
  const m = ("0" + (d.getMonth() + 1)).slice(-2);
  const da = ("0" + d.getDate()).slice(-2);
  return d.getFullYear() + "-" + m + "-" + da;
}

function mondayOf_(d) {
  const off = (d.getDay() + 6) % 7;
  const m = new Date(d); m.setDate(d.getDate() - off); return m;
}
function dateLabel_(iso) {
  const p = iso.split("-");
  const dt = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return DOW_TH[dt.getDay()] + " " + Number(p[2]) + "/" + Number(p[1]);
}
function addDaysISO_(iso, n) {
  const p = iso.split("-");
  return fmtLocal_(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n));
}
function rangeLabel_(startISO) {
  return dateLabel_(startISO) + " – " + dateLabel_(addDaysISO_(startISO, 13));
}
function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}
function pname_(o) { return o.people && o.people.name ? o.people.name : "?"; }
function priced_(o) { return o.price !== null && o.price !== undefined; }

/** Append-only upsert: update the row whose key matches, else append. */
function upsert_(name, headers, records, keyOfRow) {
  const sh = sheet_(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  const w = headers.length;
  const last = sh.getLastRow();
  const existing = last > 1 ? sh.getRange(2, 1, last - 1, w).getValues() : [];
  const map = {};
  existing.forEach((r, i) => { map[keyOfRow(r)] = i + 2; });
  const appends = [];
  records.forEach((rec) => {
    const rn = map[rec.key];
    if (rn) sh.getRange(rn, 1, 1, w).setValues([rec.row]);
    else appends.push(rec.row);
  });
  if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, w).setValues(appends);
}

// ---- TAB 1: the 2-week order grid ------------------------------------------
// Merge, don't clobber: the app's order wins when it exists; where the app has
// nothing, the cell that's already in the sheet is kept (so a hand-typed order
// is never replaced with a blank). A new 2-week window resets the grid.

/** Read the existing grid into name -> [ [loc,menu,price], ... per day ]. */
function readWeekGrid_(sh, dayCount) {
  const cols = 1 + dayCount * 3 + 1;
  const vals = sh.getRange(1, 1, sh.getLastRow(), cols).getValues();
  const prev = {};
  for (let r = 3; r < vals.length; r++) {       // skip title + 2 header rows
    const name = vals[r][0];
    if (!name || name === "รวมประจำวัน") continue;
    const triples = [];
    for (let di = 0; di < dayCount; di++) {
      const b = 1 + di * 3;                       // 0-based: name=0, day0 loc=1
      triples.push([vals[r][b] || "", vals[r][b + 1] || "", vals[r][b + 2] || ""]);
    }
    prev[name] = triples;
  }
  return prev;
}

/** Copy the finished grid to an append-only history tab, labelled + dated. */
function archiveWeekGrid_(sh, label) {
  const src = sh.getDataRange().getValues();
  if (!src.length) return;
  const width = src[0].length;
  const arch = sheet_("ประวัติตาราง");
  const start = arch.getLastRow();
  const labelRow = new Array(width).fill("");
  labelRow[0] = "📅 " + label + " · เก็บเมื่อ " + ymd_(new Date()) + " " + hhmm_();
  const block = [labelRow].concat(src).concat([new Array(width).fill("")]);
  arch.getRange(start + 1, 1, block.length, width).setValues(
    block.map((r) => { const c = r.slice(); while (c.length < width) c.push(""); return c.slice(0, width); }),
  );
  arch.getRange(start + 1, 1, 1, width).setFontWeight("bold").setBackground("#fff3cd");
}

/** Delete the retired manual emergency tab if it's still around. */
function removeOldEmergencyTab_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("🚨 สั่งฉุกเฉิน");
  if (sh) ss.deleteSheet(sh);
}

function syncWeek_() {
  // Fixed 2-week blocks (changes itself every fortnight, not weekly). Blocks are
  // aligned to a reference Monday; on Sat/Sun we look at the upcoming week so the
  // new block appears right before people start ordering for it.
  const ANCHOR = new Date(2024, 0, 1); // a Monday — fortnight blocks align to this
  const base = todayParts_();
  const eff = mondayOf_(base);
  if (base.getDay() === 0 || base.getDay() === 6) eff.setDate(eff.getDate() + 7);
  const weeks = Math.round((eff.getTime() - ANCHOR.getTime()) / (7 * 86400000));
  const mon = new Date(ANCHOR);
  mon.setDate(ANCHOR.getDate() + Math.floor(weeks / 2) * 14); // start of this fortnight
  const dates = [];
  for (let w = 0; w < 2; w++) {
    for (let i = 0; i < 5; i++) {
      const d = new Date(mon); d.setDate(mon.getDate() + w * 7 + i); dates.push(fmtLocal_(d));
    }
  }

  const people = api_("people?select=name,category,sort_order&active=eq.true&order=sort_order");
  const orders = api_(
    "orders?select=order_date,location,menu_item,price,people(name)&order_date=gte." +
    dates[0] + "&order_date=lte." + dates[dates.length - 1]);
  const settings = api_("settings?select=key,value");
  const set = {}; settings.forEach((s) => { set[s.key] = s.value; });

  // name -> date -> order
  const map = {};
  orders.forEach((o) => {
    const n = pname_(o);
    if (!map[n]) map[n] = {};
    map[n][o.order_date] = o;
  });

  const sh = sheet_("สัปดาห์นี้");
  // Same 2-week window as last time? Then keep manual cells; else start fresh.
  const props = PropertiesService.getDocumentProperties();
  const prevStart = props.getProperty("weekStart");
  const sameWindow = prevStart === dates[0] && sh.getLastRow() >= 4;
  // New window → archive the finished grid before resetting, so the fortnight's
  // orders are kept for ever (to reconcile credits if the app is down).
  if (!sameWindow && prevStart && sh.getLastRow() >= 4) {
    archiveWeekGrid_(sh, "ออเดอร์ " + rangeLabel_(prevStart));
  }
  const prev = sameWindow ? readWeekGrid_(sh, dates.length) : {};

  const COLS = 1 + dates.length * 3 + 1; // ชื่อ + (loc,menu,price)*days + รวม
  const rows = [];
  const title = new Array(COLS).fill("");
  title[0] = "ตารางสั่งข้าว 2 สัปดาห์ — อัปเดต " + hhmm_();
  rows.push(title);

  const h1 = ["ชื่อ"];
  dates.forEach((dt) => { h1.push(dateLabel_(dt), "", ""); });
  h1.push("รวม");
  rows.push(h1);

  const h2 = [""];
  dates.forEach(() => { h2.push("ส่งที่", "รายการ", "ราคา"); });
  h2.push("");
  rows.push(h2);

  const daySum = new Array(dates.length).fill(0);
  people.forEach((p) => {
    const row = [p.name];
    let total = 0;
    dates.forEach((dt, di) => {
      const o = map[p.name] && map[p.name][dt];
      let cell;
      if (o) {
        cell = [o.location || "", o.menu_item || "", priced_(o) ? Number(o.price) : ""];
      } else if (prev[p.name] && prev[p.name][di]) {
        cell = prev[p.name][di]; // keep what's already there (hand-typed)
      } else {
        cell = ["", "", ""];
      }
      row.push(cell[0], cell[1], cell[2]);
      const price = Number(cell[2]);
      if (cell[2] !== "" && !isNaN(price)) { total += price; daySum[di] += price; }
    });
    row.push(total);
    rows.push(row);
  });

  props.setProperty("weekStart", dates[0]);

  const sumRow = ["รวมประจำวัน"];
  daySum.forEach((s) => sumRow.push("", "", s));
  sumRow.push(daySum.reduce((a, b) => a + b, 0));
  rows.push(sumRow);

  // reference notes
  rows.push(new Array(COLS).fill(""));
  const note = (t) => { const r = new Array(COLS).fill(""); r[0] = t; rows.push(r); };
  if (set.or_note) note(set.or_note);
  if (set.opd_note) note(set.opd_note);
  if (set.professor_schedule) note("ตารางอาจารย์: " + set.professor_schedule);

  sh.clear();
  sh.getRange(1, 1, rows.length, COLS).setValues(rows.map((r) => {
    const c = r.slice(); while (c.length < COLS) c.push(""); return c.slice(0, COLS);
  }));
  sh.getRange(1, 1, rows.length, COLS).setBackgrounds(
    weekColors_(rows.length, dates.length, COLS, people.length),
  );
  sh.getRange(1, 1, 3, COLS).setFontWeight("bold");          // title + 2 header rows
  sh.getRange(people.length + 4, 1, 1, COLS).setFontWeight("bold"); // รวมประจำวัน
  sh.setFrozenRows(3);
  sh.setFrozenColumns(1);
  // move this tab to the front
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sh);
  SpreadsheetApp.getActiveSpreadsheet().moveActiveSheet(1);
}

// Cosmetic only: each weekday a soft colour, with white stripes between rows so
// each person's line is easy to follow. Affects nothing but the look.
function weekColors_(totalRows, dayCount, COLS, peopleCount) {
  const HEAD = ["#ffd966", "#f6b8c5", "#b6d7a8", "#9fc5e8", "#d5a6e0"]; // Mon..Fri
  const BODY = ["#fff2cc", "#fde2e4", "#e2f0d9", "#dbe9f5", "#ede0f5"];
  const WHITE = "#ffffff", GREY = "#f3f4f6", NEUTRAL = "#f1f3f4";
  const dataStart = 3, dataEnd = 2 + peopleCount, sumRow = 3 + peopleCount;

  const bg = [];
  for (let r = 0; r < totalRows; r++) {
    const row = new Array(COLS).fill(WHITE);
    if (r === 0) {
      row.fill("#fde9dc");                                   // title
    } else if (r === 1) {
      row[0] = GREY; row[COLS - 1] = GREY;                   // date header
      for (let di = 0; di < dayCount; di++) {
        const c = HEAD[di % 5];
        row[1 + di * 3] = c; row[2 + di * 3] = c; row[3 + di * 3] = c;
      }
    } else if (r === 2) {
      row.fill(GREY);                                        // sub-header
    } else if (r >= dataStart && r <= dataEnd) {
      const white = (r - dataStart) % 2 === 1;               // every other row blank
      row[0] = white ? WHITE : "#f8f9fa";
      row[COLS - 1] = white ? WHITE : NEUTRAL;
      for (let di = 0; di < dayCount; di++) {
        const c = white ? WHITE : BODY[di % 5];
        row[1 + di * 3] = c; row[2 + di * 3] = c; row[3 + di * 3] = c;
      }
    } else if (r === sumRow) {
      row.fill("#fff3cd");                                   // daily totals
    }
    bg.push(row);
  }
  return bg;
}

// ---- DB tabs (append-only) -------------------------------------------------

function logOrders_() {
  const orders = api_(
    "orders?select=order_date,location,menu_item,price,fronted,people(name,category)&order_date=gte." +
    sinceYmd_());
  const recs = orders.map((o) => ({
    key: o.order_date + "|" + pname_(o),
    row: [
      o.order_date, pname_(o), o.people ? o.people.category : "",
      o.location || "", o.menu_item || "",
      priced_(o) ? Number(o.price) : "", o.fronted ? "จ่ายเอง" : "",
    ],
  }));
  upsert_("DB_ออเดอร์",
    ["วันที่", "ชื่อ", "ชั้นปี", "ส่งที่", "เมนู", "ราคา", "สถานะ"],
    recs, (r) => r[0] + "|" + r[1]);
}

function logClaims_() {
  const claims = api_(
    "order_claims?select=date,total_paid,rolled_amount,status,people(name)&status=neq.draft&date=gte." +
    sinceYmd_());
  const recs = claims.map((c) => ({
    key: c.date,
    row: [
      c.date, c.people ? c.people.name : "?",
      c.total_paid != null ? Number(c.total_paid) : "",
      c.rolled_amount != null ? Number(c.rolled_amount) : "",
      c.status === "approved" ? "อนุมัติ" : "รออนุมัติ",
    ],
  }));
  upsert_("DB_คนจ่าย",
    ["วันที่", "คนสั่ง/จ่าย", "จ่ายร้านจริง", "โรลเข้าเครดิต", "สถานะ"],
    recs, (r) => r[0]);
}

function logCredits_() {
  const credits = api_(
    "credits?select=id,date,type,amount,note,people(name)&date=gte." + sinceYmd_());
  const TYPE = {
    topup: "เติมเงิน", front_credit: "โรล(คนสั่ง)",
    adjustment: "ปรับยอด", settlement: "ถอน/คืนเงิน",
  };
  const recs = credits.map((c) => ({
    key: c.id,
    row: [
      c.date, c.people ? c.people.name : "?", TYPE[c.type] || c.type,
      Number(c.amount), c.note || "", c.id,
    ],
  }));
  upsert_("DB_เครดิต",
    ["วันที่", "ชื่อ", "ประเภท", "จำนวน", "หมายเหตุ", "ref"],
    recs, (r) => r[5]);
}

function snapshotBalances_() {
  const today = ymd_(new Date());
  const bals = api_("balances?select=name,topups,spent,balance&order=sort_order");
  const recs = bals.map((b) => ({
    key: today + "|" + b.name,
    row: [today, b.name, Number(b.topups), Number(b.spent), Number(b.balance)],
  }));
  upsert_("DB_ยอดเครดิตรายวัน",
    ["วันที่", "ชื่อ", "เติม/โรลรวม", "ใช้ไปรวม", "คงเหลือ"],
    recs, (r) => r[0] + "|" + r[1]);
}

// ---- กองกลาง fund ledger (overwrite, with running balance) ------------------

function syncFund_() {
  const f = api_("fund_entries?select=date,description,income,expense,recipient,account,note&order=date.asc");
  const rows = [["วันที่", "รายการ", "รายรับ", "รายจ่าย", "ผู้ได้รับ", "บัญชี", "คงเหลือ", "หมายเหตุ"]];
  let bal = 0;
  f.forEach((e) => {
    bal += Number(e.income || 0) - Number(e.expense || 0);
    rows.push([
      e.date, e.description || "", Number(e.income || 0), Number(e.expense || 0),
      e.recipient || "", e.account || "", bal, e.note || "",
    ]);
  });
  const sh = sheet_("กองกลาง (จากแอป)");
  sh.clear();
  sh.getRange(1, 1, rows.length, 8).setValues(rows);
  sh.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#fde9dc");
  sh.setFrozenRows(1);
}

