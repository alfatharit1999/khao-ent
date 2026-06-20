/**
 * Backup / emergency fallback.
 *
 * A Google Apps Script mirrors the live Supabase data into this sheet every
 * minute (see google-apps-script/Backup.gs). If the app ever goes down,
 * everyone can open the sheet to see what to order — no admin needed.
 */
export const BACKUP_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1O5U8cWF2qkExg51aKELbzryopzcwzw2iquWJtcgM0oE/edit";
