"use client";

import { useState } from "react";
import type { OrderWithPerson } from "@/lib/queries";
import { updateOrderPrice } from "@/lib/queries";
import { baht } from "@/lib/format";

/**
 * One order row. When not locked, the orderer can tap to fill in / correct the
 * restaurant's price for that person's meal. Locked once the claim is submitted.
 */
export function PriceRow({
  order,
  date,
  locked,
  onSaved,
}: {
  order: OrderWithPerson;
  date: string;
  locked: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(order.price != null ? String(order.price) : "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const trimmed = val.trim();
    const price = trimmed === "" ? null : Number(trimmed);
    if (price != null && (!Number.isFinite(price) || price < 0)) return;
    setBusy(true);
    try {
      await updateOrderPrice(order.person_id, date, price);
      setEditing(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="w-20 shrink-0 truncate text-sm font-medium">
        {order.people?.name}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-muted">
        {order.menu_item}
      </span>
      {locked ? (
        <span className="shrink-0 text-sm font-semibold">
          {order.price != null ? baht(Number(order.price)) : "—"}
        </span>
      ) : editing ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <input
            value={val}
            onChange={(e) => setVal(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            autoFocus
            placeholder="0"
            className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm"
          />
          <button
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-brand px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            ✓
          </button>
        </div>
      ) : order.price != null ? (
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 text-sm font-semibold text-brand underline decoration-dotted"
        >
          {baht(Number(order.price))}
        </button>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 rounded-lg border border-debt/40 bg-debt-soft px-2 py-1 text-xs font-medium text-debt"
        >
          ใส่ราคา
        </button>
      )}
    </li>
  );
}
