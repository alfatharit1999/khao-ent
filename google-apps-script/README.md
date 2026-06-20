# Google Sheets backup / emergency mirror

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
   - **สัปดาห์นี้** grid: **~midnight** (orders placed before bed) and **~09:30**
     (the order cutoff, after people wake up).
   - **Records** (DB_* + กองกลาง): **every 8 hours**.

## What it creates

It only writes to **its own tabs** — your existing sheets are never touched.

**Live / emergency view**

| Tab | Content |
| --- | --- |
| สัปดาห์นี้ | This week's order grid (person × Mon–Fri with ส่งที่/รายการ/ราคา + totals). Refreshed ~midnight and ~09:30. |
| 🚨 สั่งฉุกเฉิน | Blank form to **hand-write orders** when the app is down. Never overwritten. |
| กองกลาง (จากแอป) | The central-fund ledger with a running balance. |

**Rollback database (append-only — never erased)**

| Tab | Content |
| --- | --- |
| DB_ออเดอร์ | Every order ever: date, person, where, menu, price, paid-status. |
| DB_คนจ่าย | Who ordered/paid each day, total paid, credit rolled, approved? |
| DB_เครดิต | Full credit ledger: top-ups, roll-overs, adjustments, withdrawals. |
| DB_ยอดเครดิตรายวัน | A **daily snapshot** of everyone's balance — so you can see the exact state on any past day and roll back if the app bugs out. |

The DB tabs keep the last 60 days in sync (older rows stay frozen as history).
Change `LOG_DAYS` in the script if you want a different window.

## Share it

Share the sheet with the residents (**Anyone with the link → Viewer**, or
Editor if you want them to be able to use the 🚨 สั่งฉุกเฉิน tab). The app also
shows a "🚨 ลิงก์สำรอง" link on every screen so people can bookmark it now.

## Notes

- The key in `Backup.gs` is the **public publishable key** — it is read-only via
  row-level security, the same key already shipped in the web app. Safe to keep.
- To change the schedule, edit the trigger lines in `setup` (the `atHour` /
  `everyHours` calls), or manage them under **Triggers** (clock icon) in the
  Apps Script editor.
- Refresh by hand any time: run `syncNow`.
