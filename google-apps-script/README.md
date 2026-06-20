# Google Sheets backup / emergency mirror

Keeps a live copy of the lunch system in a Google Sheet so that **if the app
ever goes down, everyone can still see what to order** — no admin needed.

It runs entirely inside the Sheet (Google Apps Script) and pulls read-only from
Supabase every minute. It does **not** touch the app or write back to the
database, so there is zero risk to the live system.

## Setup (once, ~3 minutes)

1. Open the backup sheet:
   <https://docs.google.com/spreadsheets/d/1O5U8cWF2qkExg51aKELbzryopzcwzw2iquWJtcgM0oE/edit>
2. **Extensions → Apps Script**.
3. Delete the sample code, paste the whole contents of [`Backup.gs`](./Backup.gs),
   click **Save**.
4. In the function dropdown pick **`setup`** → **Run**. Approve the permissions
   Google asks for (edit this sheet + fetch from the internet).
5. Done. The sheet now refreshes itself every minute.

## What it creates

| Tab | Content |
| --- | --- |
| 🚨 สั่งฉุกเฉิน | Blank form to **hand-write orders** when the app is down. The script never overwrites this. |
| วันนี้ | Today's live orders (auto, read-only) |
| สัปดาห์นี้ | This week's grid: each person × Mon–Fri with their menu |
| เครดิต | Everyone's credit balance |

## Share it

Share the sheet with the residents (**Anyone with the link → Viewer**, or
Editor if you want them to be able to use the 🚨 สั่งฉุกเฉิน tab). The app also
shows a "🚨 ลิงก์สำรอง" link on every screen so people can bookmark it now.

## Notes

- The key in `Backup.gs` is the **public publishable key** — it is read-only via
  row-level security, the same key already shipped in the web app. Safe to keep.
- To change the refresh rate, edit `everyMinutes(1)` in `setup`, or manage it
  under **Triggers** (clock icon) in the Apps Script editor.
- Refresh by hand any time: run `syncNow`.
