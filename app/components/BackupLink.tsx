"use client";

import { BACKUP_SHEET_URL } from "@/lib/backup";

/** Always-visible thin link so everyone can reach the backup sheet — even to
 *  just bookmark it now, so they have it the day the app is down. */
export function BackupLink() {
  return (
    <div className="px-4 pb-24 pt-2 text-center">
      <a
        href={BACKUP_SHEET_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] text-muted underline"
      >
        🚨 ลิงก์สำรอง (Google Sheet) — เผื่อแอปล่ม
      </a>
    </div>
  );
}

/** Full-screen fallback shown when the app can't reach the database. */
export function EmergencyScreen() {
  return (
    <div className="p-4">
      <div className="space-y-3 rounded-2xl border-2 border-debt/40 bg-debt-soft p-5 text-center">
        <p className="text-3xl">🚨</p>
        <h2 className="text-base font-bold text-debt">ระบบมีปัญหาชั่วคราว</h2>
        <p className="text-sm text-text">
          ตอนนี้ต่อฐานข้อมูลไม่ได้ — ให้สั่งข้าวผ่าน Google Sheet สำรองไปก่อน
          (ข้อมูลล่าสุดถูกสำรองไว้อัตโนมัติทุกนาที)
        </p>
        <a
          href={BACKUP_SHEET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-xl bg-debt px-3 py-3 text-sm font-semibold text-white"
        >
          เปิด Google Sheet สำรอง →
        </a>
        <button
          onClick={() => location.reload()}
          className="text-xs text-muted underline"
        >
          ลองโหลดแอปใหม่อีกครั้ง
        </button>
      </div>
    </div>
  );
}
