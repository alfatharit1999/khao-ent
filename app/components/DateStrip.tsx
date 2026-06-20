"use client";

import { upcomingDays } from "@/lib/format";

/** Horizontal strip of upcoming days for pre-ordering. */
export function DateStrip({
  selected,
  onSelect,
  days = 14,
}: {
  selected: string;
  onSelect: (iso: string) => void;
  days?: number;
}) {
  const chips = upcomingDays(days);
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="flex gap-2 pb-1">
        {chips.map((c) => {
          const active = c.iso === selected;
          return (
            <button
              key={c.iso}
              onClick={() => onSelect(c.iso)}
              className="flex w-12 shrink-0 flex-col items-center rounded-xl border px-1 py-2"
              style={{
                borderColor: active ? "var(--brand)" : "var(--border)",
                background: active ? "var(--brand)" : "var(--surface)",
                color: active ? "#fff" : "var(--text)",
              }}
            >
              <span
                className="text-[10px]"
                style={{ color: active ? "#fff" : "var(--muted)" }}
              >
                {c.isToday ? "วันนี้" : c.dow}
              </span>
              <span className="text-base font-bold leading-tight">{c.day}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
