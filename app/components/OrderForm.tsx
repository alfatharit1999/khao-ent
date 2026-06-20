"use client";

import { useEffect, useState } from "react";
import type { OrderLocation, Person } from "@/lib/types";
import { upsertMyOrder, deleteMyOrder, OrderWithPerson } from "@/lib/queries";
import { baht, isOrderLocked, ORDER_CUTOFF } from "@/lib/format";

export function OrderForm({
  me,
  existing,
  date,
  dateLabel,
  onSaved,
}: {
  me: Person;
  existing: OrderWithPerson | undefined;
  date: string;
  dateLabel?: string;
  onSaved: () => void;
}) {
  const [location, setLocation] = useState<OrderLocation>(null);
  const [menu, setMenu] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLocation(existing?.location ?? null);
    setMenu(existing?.menu_item ?? "");
    setPrice(existing?.price != null ? String(existing.price) : "");
    setErr(null);
  }, [existing, me.id]);

  const save = async () => {
    setErr(null);
    if (!location) return setErr("เลือก OR หรือ OPD ก่อน");
    if (!menu.trim()) return setErr("ใส่เมนูก่อนน้า");
    // Price is optional — leave blank if you don't know it yet; the orderer
    // fills in the restaurant's price later. If filled, it must be valid.
    const trimmedPrice = price.trim();
    let priceVal: number | null = null;
    if (trimmedPrice !== "") {
      const n = Number(trimmedPrice);
      if (!Number.isFinite(n) || n < 0) return setErr("ราคาไม่ถูกต้อง");
      priceVal = n;
    }
    setBusy(true);
    try {
      await upsertMyOrder({
        person_id: me.id,
        order_date: date,
        location,
        menu_item: menu.trim(),
        price: priceVal,
      });
      onSaved();
    } catch {
      setErr("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setErr(null);
    try {
      await deleteMyOrder(me.id, date);
      setMenu("");
      setPrice("");
      setLocation(null);
      onSaved();
    } catch {
      setErr("ลบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  // After 10:30 on the order's own day the shop order is in — freeze edits.
  if (isOrderLocked(date)) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">ออเดอร์ของฉัน · {dateLabel ?? "วันนี้"}</h3>
          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted">
            🔒 ปิดรับแล้ว
          </span>
        </div>
        {existing ? (
          <p className="text-sm">
            {existing.location ? `[${existing.location}] ` : ""}
            {existing.menu_item} —{" "}
            <span className="font-semibold">
              {existing.price != null ? baht(existing.price) : "รอร้านคิดราคา"}
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted">วันนี้คุณไม่ได้สั่ง</p>
        )}
        <p className="mt-2 text-xs text-muted">
          เลย {ORDER_CUTOFF} น. ของวันนี้แล้ว แก้ไขไม่ได้ — ถ้าจำเป็นให้แจ้งพี่บัญชี
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">ออเดอร์ของฉัน · {dateLabel ?? "วันนี้"}</h3>
        {existing ? (
          <span className="rounded-full bg-credit-soft px-2 py-0.5 text-xs font-medium text-credit">
            {existing.price != null ? `สั่งแล้ว ${baht(existing.price)}` : "สั่งแล้ว · รอราคา"}
          </span>
        ) : null}
      </div>

      <label className="mb-1 block text-xs text-muted">ส่งที่</label>
      <div className="mb-3 flex gap-2">
        {(["OR", "OPD"] as const).map((loc) => (
          <button
            key={loc}
            onClick={() => setLocation(loc)}
            className="flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium"
            style={{
              borderColor: location === loc ? "var(--brand)" : "var(--border)",
              background: location === loc ? "var(--brand-soft)" : "var(--surface)",
              color: location === loc ? "var(--brand)" : "var(--text)",
            }}
          >
            {loc}
          </button>
        ))}
      </div>

      <label className="mb-1 block text-xs text-muted">เมนู</label>
      <input
        value={menu}
        onChange={(e) => setMenu(e.target.value)}
        placeholder="เช่น ข้าวไข่ข้นหมูสับ"
        className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand"
      />

      <label className="mb-1 block text-xs text-muted">
        ราคา (บาท) — ไม่รู้ราคาเว้นว่างไว้ได้ เดี๋ยวคนสั่งใส่ให้ทีหลัง
      </label>
      <input
        value={price}
        onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
        inputMode="decimal"
        placeholder="ปล่อยว่างถ้ายังไม่รู้ราคา"
        className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand"
      />

      {err ? <p className="mb-2 text-xs text-debt">{err}</p> : null}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="flex-1 rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white active:scale-95 disabled:opacity-50"
        >
          {existing ? "อัปเดตออเดอร์" : "บันทึกออเดอร์"}
        </button>
        {existing ? (
          <button
            onClick={remove}
            disabled={busy}
            className="rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-debt active:scale-95 disabled:opacity-50"
          >
            ยกเลิก
          </button>
        ) : null}
      </div>
    </div>
  );
}
