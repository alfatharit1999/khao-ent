"use client";

import type { Person } from "@/lib/types";

const GROUP_LABEL: Record<Person["kind"], string> = {
  resident: "Resident ปี 1",
  senior: "พี่ ๆ",
  professor: "อาจารย์",
};

export function NamePicker({
  people,
  onPick,
  title = "คุณคือใคร?",
}: {
  people: Person[];
  onPick: (id: string) => void;
  title?: string;
}) {
  const groups: Person["kind"][] = ["resident", "senior", "professor"];
  return (
    <div className="p-4">
      <h2 className="mb-1 text-base font-semibold">{title}</h2>
      <p className="mb-4 text-xs text-muted">
        เลือกชื่อของคุณ (จำไว้ในเครื่องนี้ ไม่ต้องใส่รหัส)
      </p>
      {groups.map((g) => {
        const list = people.filter((p) => p.kind === g);
        if (!list.length) return null;
        return (
          <div key={g} className="mb-5">
            <div className="mb-2 text-xs font-medium text-muted">
              {GROUP_LABEL[g]}
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
