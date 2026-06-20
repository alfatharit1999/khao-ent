/**
 * ข้าว ENT — Google Sheets backup, emergency view & rollback database
 * ==================================================================
 * Pulls live data from Supabase (read-only public key) into this spreadsheet.
 * Two jobs:
 *   1. EMERGENCY VIEW — a "สัปดาห์นี้" tab (this week's order grid) + a manual
 *      "🚨 สั่งฉุกเฉิน" tab, so if the app dies everyone can still order/track.
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
 *   3. Done — it refreshes every minute on its own.
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
  setupEmergencyTab_();
  syncNow();
  const exists = ScriptApp.getProjectTriggers().some(
    (t) => t.getHandlerFunction() === "syncNow",
  );
  if (!exists) ScriptApp.newTrigger("syncNow").timeBased().everyMinutes(1).create();
  SpreadsheetApp.getActiveSpreadsheet().toast("ตั้งค่าเรียบร้อย ✓ ซิงก์ทุกนาที");
}

function syncNow() {
  syncWeek_();        // live this-week grid (overwritten)
  logOrders_();       // DB: every order (append-only)
  logClaims_();       // DB: who paid each day (append-only)
  logCredits_();      // DB: full credit ledger (append-only)
  snapshotBalances_();// DB: daily credit snapshot per person (rollback)
  syncFund_();        // กองกลาง ledger
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
  const mon = mondayOf_(new Date());
  const dates = [];
  for (let i = 0; i < 5; i++) { const d = new Date(mon); d.setDate(mon.getDate() + i); dates.push(ymd_(d)); }

  const people = api_("people?select=name,category,sort_order&active=eq.true&order=sort_order");
  const orders = api_(
    "orders?select=order_date,location,menu_item,price,people(name)&order_date=gte." +
    dates[0] + "&order_date=lte." + dates[4]);
  const settings = api_("settings?select=key,value");
  const set = {}; settings.forEach((s) => { set[s.key] = s.value; });

  // name -> date -> {loc, menu, price}
  const map = {};
  orders.forEach((o) => {
    const n = pname_(o);
    if (!map[n]) map[n] = {};
    map[n][o.order_date] = o;
  });

  const COLS = 1 + 5 * 3 + 1; // ชื่อ + (loc,menu,price)*5 + รวม
  const rows = [];
  const title = new Array(COLS).fill("");
  title[0] = "ตารางสั่งข้าวสัปดาห์นี้ — อัปเดต " + hhmm_();
  rows.push(title);

  const h1 = ["ชื่อ"];
  dates.forEach((dt) => { h1.push(dateLabel_(dt), "", ""); });
  h1.push("รวม");
  rows.push(h1);

  const h2 = [""];
  dates.forEach(() => { h2.push("ส่งที่", "รายการ", "ราคา"); });
  h2.push("");
  rows.push(h2);

  const daySum = [0, 0, 0, 0, 0];
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

// ---- manual emergency order form (set up once, never overwritten) -----------

function setupEmergencyTab_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName("🚨 สั่งฉุกเฉิน")) return;
  const sh = ss.insertSheet("🚨 สั่งฉุกเฉิน", 0);
  sh.getRange(1, 1, 2, 4).setValues([
    ["🚨 สั่งฉุกเฉิน — ใช้ตอนแอปล่ม พิมพ์ออเดอร์ตรงนี้ได้เลย", "", "", ""],
    ["ชื่อ", "ที่ส่ง (OR/OPD)", "เมนู", "ราคา (ถ้ารู้)"],
  ]);
  sh.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#fde8e8");
  sh.getRange(2, 1, 1, 4).setFontWeight("bold").setBackground("#f3f4f6");
  sh.setFrozenRows(2);
  sh.setColumnWidth(3, 240);
}
