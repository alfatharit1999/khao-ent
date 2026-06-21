/**
 * ข้าว ENT — Google Sheets backup, emergency view & rollback database
 * ==================================================================
 * Pulls live data from Supabase (read-only public key) into this spreadsheet.
 * Two jobs:
 *   1. EMERGENCY VIEW — a "สัปดาห์นี้" tab (the next 2 weeks of weekdays) and a
 *      "🚨 สั่งฉุกเฉิน" tab pre-filled with every member + today's saved order,
 *      so if the app dies everyone can still order/track from the latest save.
 *   2. ROLLBACK DATABASE — append-only log tabs that never erase: every order,
 *      who paid each day, the full credit ledger, and a daily credit snapshot.
 *      If the app ever bugs out you can see the exact state at any past time.
 *
 * It only READS from Supabase and only writes to its OWN tabs — your existing
 * sheets are never touched.
 *
 * ONE-TIME SETUP
 *   1. Extensions → Apps Script. Paste this whole file. Save.
 *   2. Function dropdown → `setup` → Run. Approve permissions.
 *   3. Done. Schedule (Asia/Bangkok):
 *        • This-week grid: ~midnight and ~09:30 (the order cutoff).
 *        • Records (orders/payments/credits/snapshot/fund): every 8 hours.
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
  syncNow(); // build everything immediately

  // Clear any triggers we created before, then set the schedule fresh.
  const mine = ["syncNow", "syncWeekTab", "syncLogs"];
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (mine.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });

  // This-week order grid: at midnight (people ordering before bed) and at the
  // 09:30 cutoff (people ordering after they wake up). (±15 min, Apps Script.)
  ScriptApp.newTrigger("syncWeekTab").timeBased().atHour(0).nearMinute(5).everyDays(1).create();
  ScriptApp.newTrigger("syncWeekTab").timeBased().atHour(9).nearMinute(30).everyDays(1).create();

  // Records (orders/payments/credits/snapshots/fund): every 8 hours.
  ScriptApp.newTrigger("syncLogs").timeBased().everyHours(8).create();

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "ตั้งค่าเรียบร้อย ✓ ตารางอัปเดตเที่ยงคืน+9:30 · บันทึกทุก 8 ชม.",
  );
}

/** Everything at once (used on setup + as a manual "refresh now"). */
function syncNow() {
  syncWeekTab();
  syncLogs();
}

/** 2-week grid + today's pre-filled emergency list. Trigger: midnight + 09:30. */
function syncWeekTab() {
  syncWeek_();
  fillEmergencyToday_();
}

/** Append-only records + fund. Trigger: every 8 hours. */
function syncLogs() {
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

// ---- TAB 1: this week's grid (live, overwritten) ---------------------------

function syncWeek_() {
  // Two weeks of weekdays. On Sat/Sun jump to the upcoming week (the work week
  // just finished), so you always see the days people are about to order for.
  const base = todayParts_();
  const mon = mondayOf_(base);
  if (base.getDay() === 0 || base.getDay() === 6) mon.setDate(mon.getDate() + 7);
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

  // name -> date -> {loc, menu, price}
  const map = {};
  orders.forEach((o) => {
    const n = pname_(o);
    if (!map[n]) map[n] = {};
    map[n][o.order_date] = o;
  });

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
      if (o) {
        const pr = priced_(o) ? Number(o.price) : "";
        row.push(o.location || "", o.menu_item || "", pr);
        if (priced_(o)) { total += Number(o.price); daySum[di] += Number(o.price); }
      } else {
        row.push("", "", "");
      }
    });
    row.push(total);
    rows.push(row);
  });

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

  const sh = sheet_("สัปดาห์นี้");
  sh.clear();
  sh.getRange(1, 1, rows.length, COLS).setValues(rows.map((r) => {
    const c = r.slice(); while (c.length < COLS) c.push(""); return c.slice(0, COLS);
  }));
  sh.getRange(1, 1, 1, COLS).setFontWeight("bold").setBackground("#fde9dc");
  sh.getRange(2, 1, 2, COLS).setFontWeight("bold").setBackground("#f3f4f6");
  sh.setFrozenRows(3);
  sh.setFrozenColumns(1);
  // move this tab to the front
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sh);
  SpreadsheetApp.getActiveSpreadsheet().moveActiveSheet(1);
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

// ---- emergency order list: every member + today's saved order --------------
// Refreshed at midnight + 09:30. Everyone is listed; people who have ordered are
// pre-filled (the most recent save), the rest are blank to type into by hand if
// the app is down — so nobody has to re-enter everything.

function fillEmergencyToday_() {
  const today = ymd_(new Date());
  const people = api_("people?select=name,sort_order&active=eq.true&order=sort_order");
  const orders = api_(
    "orders?select=location,menu_item,price,people(name)&order_date=eq." + today);
  const map = {};
  orders.forEach((o) => { map[pname_(o)] = o; });

  const rows = [
    ["🚨 สั่งฉุกเฉิน — ออเดอร์วันนี้ " + today + " · อัปเดต " + hhmm_() +
      " — ถ้าแอปล่ม พิมพ์/แก้ตรงนี้ได้เลย", "", "", ""],
    ["ชื่อ", "ส่งที่ (OR/OPD)", "เมนู", "ราคา (ถ้ารู้)"],
  ];
  people.forEach((p) => {
    const o = map[p.name];
    rows.push(
      o
        ? [p.name, o.location || "", o.menu_item || "", priced_(o) ? Number(o.price) : ""]
        : [p.name, "", "", ""],
    );
  });

  const sh = sheet_("🚨 สั่งฉุกเฉิน");
  sh.clear();
  sh.getRange(1, 1, rows.length, 4).setValues(rows);
  sh.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#fde8e8");
  sh.getRange(2, 1, 1, 4).setFontWeight("bold").setBackground("#f3f4f6");
  sh.setFrozenRows(2);
  sh.setColumnWidth(3, 240);
}
