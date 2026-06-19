"use client";

import { useState } from "react";
import type { Category, Person } from "@/lib/types";
import { CATEGORY_ORDER, CATEGORY_LABEL } from "@/lib/categories";

export function NamePicker({
  people,
  onPick,
  onCreate,
  title = "คุณคือใคร?",
}: {
  people: Person[];
  onPick: (id: string) => void;
  onCreate?: (name: string, category: Category) => Promise<void>;
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

      {onCreate ? <AddName onCreate={onCreate} /> : null}
    </div>
  );
}

function AddName({
  onCreate,
}: {
  onCreate: (name: string, category: Category) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("F1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-xl border border-dashed border-border px-3 py-3 text-sm font-medium text-muted active:scale-95"
      >
        + ไม่มีชื่อฉัน เพิ่มชื่อใหม่
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">เพิ่มชื่อใหม่</h3>
        <button onClick={() => setOpen(false)} className="text-xs text-muted">
          ปิด
        </button>
      </div>
      <p className="text-xs text-muted">
        สำหรับคนนอกที่อยากสั่งด้วย เช่น อาจารย์/fellow ท่านอื่น
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ชื่อ (เช่น อ.สมชาย / F2 มีน)"
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as Category)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
      >
        {CATEGORY_ORDER.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABEL[c]}
          </option>
        ))}
      </select>
      {err ? <p className="text-xs text-debt">{err}</p> : null}
      <button
        disabled={busy || !name.trim()}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await onCreate(name.trim(), category);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "เพิ่มไม่สำเร็จ");
            setBusy(false);
          }
        }}
        className="w-full rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        เพิ่ม & เลือกชื่อนี้
      </button>
    </div>
  );
}
