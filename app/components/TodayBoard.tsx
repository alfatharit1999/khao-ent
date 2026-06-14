"use client";

import type { OrderWithPerson } from "@/lib/queries";
import { baht } from "@/lib/format";

function LocBadge({ loc }: { loc: "OR" | "OPD" | null }) {
  if (!loc) return null;
  const isOR = loc === "OR";
  return (
    <span
      className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
      style={{
        background: isOR ? "#eef2ff" : "#fef3e8",
        color: isOR ? "#4f46e5" : "#c2620f",
      }}
    >
      {loc}
    </span>
  );
}

export function TodayBoard({
  orders,
  meId,
}: {
  orders: OrderWithPerson[];
  meId: string | null;
}) {
  const total = orders.reduce((s, o) => s + Number(o.price), 0);

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-semibold">ออเดอร์วันนี้</h3>
        <span className="text-sm text-muted">{orders.length} รายการ</span>
      </div>

      {orders.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">
          ยังไม่มีใครสั่งวันนี้
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {orders.map((o) => (
            <li
              key={o.id}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{ background: o.person_id === meId ? "var(--brand-soft)" : undefined }}
            >
              <div className="w-20 shrink-0 truncate text-sm font-medium">
                {o.people?.name}
              </div>
              <LocBadge loc={o.location} />
              <div className="min-w-0 flex-1 truncate text-sm text-muted">
                {o.menu_item}
              </div>
              <div className="shrink-0 text-sm font-semibold">
                {baht(Number(o.price))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {orders.length > 0 ? (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-sm font-medium">รวมวันนี้</span>
          <span className="text-base font-bold text-brand">{baht(total)}</span>
        </div>
      ) : null}
    </div>
  );
}
