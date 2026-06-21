# Google Sheets backup & rollback database

Keeps a live copy of the lunch system in a Google Sheet so that **if the app
ever goes down, everyone can still see what to order** — no admin needed.

It runs entirely inside the Sheet (Google Apps Script) and pulls read-only from
Supabase on a schedule (see below). It does **not** touch the app or write back
to the database, so there is zero risk to the live system.

## Setup (once, ~3 minutes)

1. Open the backup sheet:
   <https://docs.google.com/spreadsheets/d/1O5U8cWF2qkExg51aKELbzryopzcwzw2iquWJtcgM0oE/edit>
2. **Extensions → Apps Script**.
3. Delete the sample code, paste the whole contents of [`Backup.gs`](./Backup.gs),
   click **Save**.
4. In the function dropdown pick **`setup`** → **Run**. Approve the permissions
   Google asks for (edit this sheet + fetch from the internet).
5. Done. Auto-refresh schedule (Asia/Bangkok, ±15 min — Apps Script isn't exact):
   - **Order grid** (สัปดาห์นี้): **midnight, 08:00, 09:00, 09:30** (merge-update).
   - **Money & history** (DB_* + กองกลาง): **13:00 and 21:00** (twice a day).

## What it creates

It only writes to **its own tabs** — your existing sheets are never touched.

**Live view**

| Tab | Content |
| --- | --- |
| สัปดาห์นี้ | The **next 2 weeks** of weekdays (person × day with ส่งที่/รายการ/ราคา + totals). On weekends it jumps to the upcoming week. **Merge-updated**: the app's order wins where it exists; where the app has nothing, an existing cell is kept — so a hand-typed order is never blanked out. Resets when a new 2-week window starts. |
| กองกลาง (จากแอป) | The central-fund ledger with a running balance. |

**Rollback database (append-only — never erased)**

| Tab | Content |
| --- | --- |
| DB_ออเดอร์ | Every order ever: date, person, where, menu, price, paid-status. |
| DB_คนจ่าย | Who ordered/paid each day, total paid, credit rolled, approved? |
| DB_เครดิต | Full credit ledger: top-ups, roll-overs, adjustments, withdrawals. |
| DB_ยอดเครดิตรายวัน | A **daily snapshot** of everyone's balance — so you can see the exact state on any past day and roll back if the app bugs out. |
| ประวัติตาราง | A **copy of each 2-week order grid**, archived (labelled + dated) just before a new fortnight resets the live grid — so every past fortnight's orders are kept for reconciling credits. |

The DB tabs keep the last 60 days in sync (older rows stay frozen as history).
Change `LOG_DAYS` in the script if you want a different window.

## Share it

Share the sheet with the residents (**Anyone with the link → Viewer**, or
Editor if you want them to be able to hand-edit the สัปดาห์นี้ grid when the app
is down). The app also shows a "🚨 ลิงก์สำรอง" link on every screen so people can
bookmark it now.

## Notes

- The key in `Backup.gs` is the **public publishable key** — it is read-only via
  row-level security, the same key already shipped in the web app. Safe to keep.
- To change the schedule, edit the trigger lines in `setup` (the `atHour` /
  `everyHours` calls), or manage them under **Triggers** (clock icon) in the
  Apps Script editor.
- Refresh by hand any time: run `syncNow`.
