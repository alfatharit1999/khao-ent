/**
 * ข้าว ENT — Google Sheets backup / emergency mirror
 * ===================================================
 * Pulls the live data straight from Supabase (read-only public key) into this
 * spreadsheet every minute, so if the app ever goes down everyone can still
 * open the sheet and see what to order. You never have to touch it.
 *
 * ONE-TIME SETUP
 *   1. In the sheet: Extensions → Apps Script.
 *   2. Delete any sample code, paste THIS whole file, click Save (disk icon).
 *   3. In the function dropdown choose `setup`, click Run.
 *      Approve the permissions when Google asks (it needs to edit this sheet
 *      and fetch from the internet).
 *   4. That's it. The sheet now refreshes itself every minute. A "🚨 สั่งฉุกเฉิน"
 *      tab is created for hand-written orders if the app is down.
 *
 * Refresh by hand any time: choose `syncNow` → Run.
 */

const SUPABASE_URL = "https://qfruxadnsxvmhojdgciv.supabase.co";
// Public publishable/anon key — safe to keep here; RLS makes it read-only.
const SUPABASE_KEY = "sb_publishable_HvCLw8bEjdnrtsFjkc5skw_ghEy3cq5";
const TZ = "Asia/Bangkok";

const DOW_TH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

/** Run once: build everything + start the auto-refresh trigger. */
function setup() {
  setupEmergencyTab_();
  syncNow();
  const exists = ScriptApp.getProjectTriggers().some(
    (t) => t.getHandlerFunction() === "syncNow",
  );
  if (!exists) {
    ScriptApp.newTrigger("syncNow").timeBased().everyMinutes(1).create();
  }
  SpreadsheetApp.getActiveSpreadsheet().toast("ตั้งค่าเรียบร้อย ✓ ซิงก์อัตโนมัติทุกนาที");
}

/** Pull everything from Supabase into the mirror tabs. */
function syncNow() {
  syncToday_();
  syncWeek_();
  syncBalances_();
}

// ---- Supabase REST helper --------------------------------------------------

function api_(path) {
  const res = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/" + path, {
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) throw new Error(res.getContentText());
  return JSON.parse(res.getContentText());
}

function ymd_(d) {
  return Utilities.formatDate(d, TZ, "yyyy-MM-dd");
}

function mondayOf_(d) {
  const offset = (d.getDay() + 6) % 7; // 0 = Monday
  const m = new Date(d);
  m.setDate(d.getDate() - offset);
  return m;
}

function dateLabel_(iso) {
  const parts = iso.split("-");
  const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return DOW_TH[dt.getDay()] + " " + Number(parts[2]) + "/" + Number(parts[1]);
}

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function personName_(o) {
  return o.people && o.people.name ? o.people.name : "?";
}

// ---- Tab: today's orders ---------------------------------------------------

function syncToday_() {
  const today = ymd_(new Date());
  const orders = api_(
    "orders?select=location,menu_item,price,people(name,category,sort_order)&order_date=eq." +
      today,
  );
  orders.sort(
    (a, b) =>
      ((a.people && a.people.sort_order) || 0) -
      ((b.people && b.people.sort_order) || 0),
  );

  const rows = [
    ["ออเดอร์วันนี้ · " + today, "", "", ""],
    ["ชื่อ", "ที่ส่ง", "เมนู", "ราคา"],
  ];
  let total = 0;
  orders.forEach((o) => {
    const priced = o.price !== null && o.price !== undefined;
    if (priced) total += Number(o.price);
    rows.push([
      personName_(o),
      o.location || "",
      o.menu_item || "",
      priced ? Number(o.price) : "รอราคา",
    ]);
  });
  rows.push(["", "", "รวม", total]);
  rows.push(["อัปเดตล่าสุด", Utilities.formatDate(new Date(), TZ, "HH:mm:ss"), "", ""]);

  writeBlock_("วันนี้", rows, 4);
}

// ---- Tab: this week's grid (people × Mon–Fri) ------------------------------

function syncWeek_() {
  const mon = mondayOf_(new Date());
  const dates = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    dates.push(ymd_(d));
  }

  const people = api_(
    "people?select=name,category,sort_order&active=eq.true&order=sort_order",
  );
  const orders = api_(
    "orders?select=order_date,menu_item,price,people(name)&order_date=gte." +
      dates[0] +
      "&order_date=lte." +
      dates[4],
  );

  const map = {};
  orders.forEach((o) => {
    const n = personName_(o);
    if (!map[n]) map[n] = {};
    const pr = o.price !== null && o.price !== undefined ? " (" + o.price + ")" : "";
    map[n][o.order_date] = (o.menu_item || "-") + pr;
  });

  const header = ["ชื่อ"].concat(dates.map(dateLabel_));
  const rows = [["ตารางอาหารสัปดาห์นี้", "", "", "", "", ""], header];
  people.forEach((p) => {
    const row = [p.name];
    dates.forEach((dt) => row.push(map[p.name] && map[p.name][dt] ? map[p.name][dt] : ""));
    rows.push(row);
  });

  writeBlock_("สัปดาห์นี้", rows, header.length);
}

// ---- Tab: balances ---------------------------------------------------------

function syncBalances_() {
  const b = api_("balances?select=name,topups,spent,balance&order=sort_order");
  const rows = [["เครดิตคงเหลือ", "", "", ""], ["ชื่อ", "เติม/โรล", "ใช้ไป", "คงเหลือ"]];
  b.forEach((x) =>
    rows.push([x.name, Number(x.topups), Number(x.spent), Number(x.balance)]),
  );
  writeBlock_("เครดิต", rows, 4);
}

// ---- Tab: manual emergency order form (set up once, never overwritten) -----

function setupEmergencyTab_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName("🚨 สั่งฉุกเฉิน")) return;
  const sh = ss.insertSheet("🚨 สั่งฉุกเฉิน", 0); // first tab
  const rows = [
    ["🚨 สั่งฉุกเฉิน — ใช้ตอนแอปล่ม พิมพ์ออเดอร์ตรงนี้ได้เลย", "", "", ""],
    ["ชื่อ", "ที่ส่ง (OR/OPD)", "เมนู", "ราคา (ถ้ารู้)"],
  ];
  sh.getRange(1, 1, rows.length, 4).setValues(rows);
  sh.getRange(1, 1, 1, 4).merge().setFontWeight("bold").setBackground("#fde8e8");
  sh.getRange(2, 1, 1, 4).setFontWeight("bold").setBackground("#f3f4f6");
  sh.setFrozenRows(2);
  for (let c = 1; c <= 4; c++) sh.setColumnWidth(c, c === 3 ? 240 : 120);
}

// ---- Shared writer ---------------------------------------------------------

function writeBlock_(name, rows, cols) {
  const sh = sheet_(name);
  sh.clearContents();
  const width = cols || (rows[0] ? rows[0].length : 1);
  // pad ragged rows so setValues gets a rectangle
  const padded = rows.map((r) => {
    const copy = r.slice();
    while (copy.length < width) copy.push("");
    return copy.slice(0, width);
  });
  sh.getRange(1, 1, padded.length, width).setValues(padded);
  sh.getRange(1, 1, 1, width).merge().setFontWeight("bold").setBackground("#fde9dc");
  if (padded.length > 1) {
    sh.getRange(2, 1, 1, width).setFontWeight("bold").setBackground("#f3f4f6");
  }
  sh.setFrozenRows(2);
}
