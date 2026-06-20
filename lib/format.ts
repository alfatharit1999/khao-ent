/** Format a number as Thai baht, e.g. 1485.25 -> "฿1,485.25" (no trailing .00). */
export function baht(n: number): string {
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  const hasDecimals = Math.abs(rounded % 1) > 0.0001;
  const formatted = rounded.toLocaleString("th-TH", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `฿${formatted}`;
}

/** Local YYYY-MM-DD for "today" in Asia/Bangkok regardless of server TZ. */
export function todayISO(): string {
  const now = new Date();
  const bangkok = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const y = bangkok.getFullYear();
  const m = String(bangkok.getMonth() + 1).padStart(2, "0");
  const d = String(bangkok.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const THAI_DOW = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const THAI_MONTH = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** Human Thai date like "ส. 14 มิ.ย." */
export function thaiDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${THAI_DOW[dt.getDay()]} ${d} ${THAI_MONTH[m - 1]}`;
}

function toISO(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Orders for a day lock at this time (Asia/Bangkok) — when the shop order goes in. */
export const ORDER_CUTOFF = "09:30";

/** True once it's past 09:30 (Bangkok) on the order's own date — no more edits. */
export function isOrderLocked(orderISO: string): boolean {
  const nowBkk = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const [y, m, d] = orderISO.split("-").map(Number);
  const cutoff = new Date(y, m - 1, d, 9, 30, 0, 0);
  return nowBkk >= cutoff;
}

/** ISO date `n` days after `iso`. */
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toISO(new Date(y, m - 1, d + n));
}

export type DayChip = {
  iso: string;
  dow: string; // อา./จ./...
  day: number;
  isToday: boolean;
  isPast: boolean;
};

/** `count` consecutive days starting today (Asia/Bangkok). */
export function upcomingDays(count: number): DayChip[] {
  const today = todayISO();
  return Array.from({ length: count }, (_, i) => {
    const iso = addDaysISO(today, i);
    const [y, m, d] = iso.split("-").map(Number);
    return {
      iso,
      dow: THAI_DOW[new Date(y, m - 1, d).getDay()],
      day: d,
      isToday: i === 0,
      isPast: false,
    };
  });
}

/** Monday→Sunday range (ISO strings) for the week containing `iso` (default today). */
export function weekRange(iso: string = todayISO()): { start: string; end: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay(); // 0 Sun … 6 Sat
  const offsetToMonday = (dow + 6) % 7;
  const monday = new Date(y, m - 1, d - offsetToMonday);
  const sunday = new Date(y, m - 1, d - offsetToMonday + 6);
  return { start: toISO(monday), end: toISO(sunday) };
}
