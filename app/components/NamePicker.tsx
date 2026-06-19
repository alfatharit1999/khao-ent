"use client";

import type { Person } from "@/lib/types";
import { CATEGORY_ORDER, CATEGORY_LABEL } from "@/lib/categories";

export function NamePicker({
  people,
  onPick,
  title = "คุณคือใคร?",
}: {
  people: Person[];
  onPick: (id: string) => void;
  title?: string;
}) {
  return (
    <div className="p-4">
      <h2 className="mb-1 text-base font-semibold">{title}</h2>
      <p className="mb-4 text-xs text-muted">
        เลือกชื่อของคุณ (จำไว้ในเครื่องนี้ ไม่ต้องใส่รหัส)
      </p>
      {CATEGORY_ORDER.map((cat) => {
        const list = people.filter((p) => p.category === cat);
        if (!list.length) return null;
        return (
          <div key={cat} className="mb-5">
            <div className="mb-2 text-xs font-medium text-muted">
              {CATEGORY_LABEL[cat]}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {list.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPick(p.id)}
                  className="rounded-xl border border-border bg-surface px-2 py-3 text-sm font-medium active:scale-95"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
