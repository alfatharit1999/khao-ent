"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getClaimForDate,
  getDayState,
  getOrdersForDate,
  getPeople,
  getSettings,
  setProfessorMeal,
  skipProfessor,
  OrderWithPerson,
} from "@/lib/queries";
import type { DayState, OrderClaim, Person } from "@/lib/types";
import {
  PROFESSOR_MENU,
  PROFESSOR_BOX_NOTE,
  PROFESSOR_RESTRICTIONS,
  OR_DELIVERY,
  OPD_DELIVERY,
  randomProfMenu,
  professorScheduleHint,
  type ProfLocation,
} from "@/lib/professorMenu";
import { baht, thaiDate, todayISO } from "@/lib/format";
import { PageHeader, SetupHint } from "../components/ui";
import { PriceRow } from "../components/PriceRow";

type LocKey = "OR" | "OPD" | "ไม่ระบุ";
const LOC_ORDER: LocKey[] = ["OR", "OPD", "ไม่ระบุ"];

export default function OrderListPage() {
  const [date, setDate] = useState(todayISO());
  const [orders, setOrders] = useState<OrderWithPerson[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [day, setDay] = useState<DayState>({ date, sealed: false, prof_status: null });
  const [claim, setClaim] = useState<OrderClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const [o, d, c] = await Promise.all([
      getOrdersForDate(date),
      getDayState(date),
      getClaimForDate(date),
    ]);
    setOrders(o);
    setDay(d);
    setClaim(c);
  }, [date]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [p, s] = await Promise.all([getPeople(), getSettings()]);
        setPeople(p);
        setSettings(s);
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  if (!isSupabaseConfigured) {
    return (
      <main>
        <PageHeader title="รวมออเดอร์" />
        <SetupHint />
      </main>
    );
  }

  // Once the claim is submitted, prices + professor are frozen.
  const locked = claim?.status === "pending" || claim?.status === "approved";

  const professor = people.find((p) => p.category === "professor") ?? null;
  const profOrder = professor
    ? orders.find((o) => o.person_id === professor.id)
    : undefined;
  const residentOrders = orders.filter(
    (o) => o.people?.category !== "professor",
  );

  const byLoc = (loc: LocKey) =>
    residentOrders.filter((o) => (o.location ?? "ไม่ระบุ") === loc);
  const grand = orders.reduce((s, o) => s + Number(o.price ?? 0), 0);
  const pendingPrice = residentOrders.filter((o) => o.price == null);
  const allPriced = pendingPrice.length === 0;

  const profBoxes = profOrder
    ? profOrder.location === "BOTH"
      ? 2
      : 1
    : 0;
  const totalBoxes = residentOrders.length + profBoxes;

  const buildText = () => {
    const lines: string[] = [`🍚 ออเดอร์ข้าว ${thaiDate(date)}`];
    LOC_ORDER.forEach((loc) => {
      const list = byLoc(loc);
      if (!list.length) return;
      const note =
        loc === "OR" ? settings.or_note : loc === "OPD" ? settings.opd_note : "";
      lines.push("");
      lines.push(`— ${loc} —${note ? ` (${note})` : ""}`);
      list.forEach((o) =>
        lines.push(
          `${o.people?.name}: ${o.menu_item ?? "-"}${o.price != null ? ` (${o.price})` : ""}`,
        ),
      );
    });

    lines.push("");
    lines.push(`⭐ อ.ไพบูลย์ — ${PROFESSOR_BOX_NOTE} (${PROFESSOR_RESTRICTIONS})`);
    if (day.prof_status === "skip" || !profOrder) {
      lines.push("  วันนี้ไม่สั่ง");
    } else {
      const unit =
        Number(profOrder.price ?? 0) / (profOrder.location === "BOTH" ? 2 : 1);
      if (profOrder.location === "OR" || profOrder.location === "BOTH")
        lines.push(`  • OR: ${profOrder.menu_item} (${unit})`);
      if (profOrder.location === "OPD" || profOrder.location === "BOTH")
        lines.push(`  • OPD: ${profOrder.menu_item} (${unit})`);
    }

    lines.push("");
    lines.push(`รวม ${totalBoxes} กล่อง`);
    return lines.join("\n");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  // The menu can be sent to the restaurant as soon as the professor is settled —
  // prices come back from the restaurant afterwards, so they don't gate copying.
  const canCopy = day.prof_status !== null;

  return (
    <main>
      <PageHeader
        title="รวมออเดอร์"
        subtitle="ส่งเมนูให้ร้าน → ใส่ราคาทีหลัง → เคลมที่แท็บ “เคลม”"
        right={
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
          />
        }
      />

      {loading ? (
        <p className="p-8 text-center text-sm text-muted">กำลังโหลด…</p>
      ) : (
        <div className="space-y-4 p-4">
          {professor ? (
            <ProfessorCard
              professorId={professor.id}
              date={date}
              existing={profOrder}
              day={day}
              locked={locked}
              onChanged={load}
            />
          ) : null}

          {residentOrders.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
              ยังไม่มีออเดอร์ของ resident วันนี้
            </p>
          ) : (
            LOC_ORDER.map((loc) => {
              const list = byLoc(loc);
              if (!list.length) return null;
              const sub = list.reduce((s, o) => s + Number(o.price ?? 0), 0);
              return (
                <div
                  key={loc}
                  className="overflow-hidden rounded-2xl border border-border bg-surface"
                >
                  <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
                    <span className="text-sm font-semibold">{loc}</span>
                    <span className="text-xs text-muted">{baht(sub)}</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {list.map((o) => (
                      <PriceRow
                        key={o.id}
                        order={o}
                        date={date}
                        locked={locked}
                        onSaved={load}
                      />
                    ))}
                  </ul>
                </div>
              );
            })
          )}

          {!allPriced ? (
            <p className="rounded-xl bg-background px-3 py-2 text-xs text-muted">
              ℹ️ {pendingPrice.length} เมนูยังไม่มีราคา — ส่งร้านได้เลย
              ไว้ร้านคิดเงินแล้วค่อยมาใส่ราคา (แตะ &quot;ใส่ราคา&quot;) ก่อนไปเคลม
            </p>
          ) : null}

          <div className="flex items-center justify-between rounded-2xl bg-brand-soft px-4 py-3">
            <span className="text-sm font-medium">รวม {totalBoxes} กล่อง</span>
            <span className="text-lg font-bold text-brand">
              {allPriced ? baht(grand) : `${baht(grand)} (ยังไม่ครบ)`}
            </span>
          </div>

          <button
            onClick={copy}
            disabled={!canCopy}
            className="w-full rounded-xl bg-brand px-3 py-3 text-sm font-semibold text-white active:scale-95 disabled:opacity-40"
          >
            {!canCopy
              ? "⭐ ยืนยันข้าวอาจารย์ก่อนถึงจะคัดลอกได้"
              : copied
                ? "คัดลอกแล้ว ✓"
                : "📋 คัดลอกเมนูส่งร้าน"}
          </button>

          {locked ? (
            <p className="rounded-xl bg-credit-soft px-3 py-2 text-center text-xs text-credit">
              🔒 เคลมแล้ว — ราคาถูกล็อก (ไปที่แท็บ “เคลม” เพื่อดูสถานะ)
            </p>
          ) : (
            <p className="rounded-xl bg-background px-3 py-2 text-center text-xs text-muted">
              ใส่ราคาครบแล้ว ไปที่แท็บ <b>เคลม</b> เพื่อโรลเครดิตเข้าคนสั่ง
            </p>
          )}
        </div>
      )}
    </main>
  );
}

function ProfessorCard({
  professorId,
  date,
  existing,
  day,
  locked,
  onChanged,
}: {
  professorId: string;
  date: string;
  existing: OrderWithPerson | undefined;
  day: DayState;
  locked: boolean;
  onChanged: () => void;
}) {
  const hint = professorScheduleHint(date);
  const [mode, setMode] = useState<"order" | "skip">("order");
  const [location, setLocation] = useState<ProfLocation>("OR");
  const [menu, setMenu] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Initialise from the saved meal / status, else from a random suggestion.
  useEffect(() => {
    if (existing) {
      setMode("order");
      setLocation((existing.location as ProfLocation) ?? "OR");
      setMenu(existing.menu_item ?? "");
      const unit =
        Number(existing.price ?? 0) / (existing.location === "BOTH" ? 2 : 1);
      setPrice(existing.price != null ? String(unit) : "");
    } else if (day.prof_status === "skip") {
      setMode("skip");
    } else {
      setMode("order");
      const m = randomProfMenu();
      setMenu(m.th);
      setPrice(String(m.price));
      setLocation(hint.suggest === "SKIP" ? "OR" : hint.suggest);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, day.prof_status, date]);

  const reroll = () => {
    const m = randomProfMenu(menu);
    setMenu(m.th);
    setPrice(String(m.price));
  };

  const save = async () => {
    setErr(null);
    const p = Number(price);
    if (!menu.trim()) return setErr("เลือกเมนูก่อน");
    if (!Number.isFinite(p) || p <= 0) return setErr("ราคาไม่ถูกต้อง");
    setBusy(true);
    try {
      await setProfessorMeal({
        professor_id: professorId,
        date,
        location,
        menu_item: menu.trim(),
        unit_price: p,
      });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    setBusy(true);
    setErr(null);
    try {
      await skipProfessor(professorId, date);
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const total = (Number(price) || 0) * (location === "BOTH" ? 2 : 1);

  // Read-only summary once the claim is locked.
  if (locked) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="mb-1 font-semibold">⭐ ข้าวอาจารย์ไพบูลย์</h3>
        {day.prof_status === "skip" || !existing ? (
          <p className="text-sm text-muted">วันนี้ไม่สั่ง</p>
        ) : (
          <p className="text-sm">
            {existing.location === "BOTH" ? "OR + OPD" : existing.location} ·{" "}
            {existing.menu_item} —{" "}
            <span className="font-semibold">
              {existing.price != null ? baht(Number(existing.price)) : "—"}
            </span>
          </p>
        )}
        <p className="mt-1 text-xs text-muted">เคลมแล้ว — แก้ไม่ได้</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border-2 border-brand/30 bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">⭐ ข้าวอาจารย์ไพบูลย์</h3>
        {day.prof_status ? (
          <span className="rounded-full bg-credit-soft px-2 py-0.5 text-[10px] font-medium text-credit">
            ยืนยันแล้ว
          </span>
        ) : (
          <span className="rounded-full bg-debt-soft px-2 py-0.5 text-[10px] font-medium text-debt">
            ยังไม่ยืนยัน
          </span>
        )}
      </div>
      <p className="text-xs text-muted">{hint.text}</p>

      <div className="flex gap-2">
        {(["order", "skip"] as const).map((mo) => (
          <button
            key={mo}
            onClick={() => setMode(mo)}
            className="flex-1 rounded-xl border px-3 py-2 text-sm font-medium"
            style={{
              borderColor: mode === mo ? "var(--brand)" : "var(--border)",
              background: mode === mo ? "var(--brand-soft)" : "var(--surface)",
              color: mode === mo ? "var(--brand)" : "var(--text)",
            }}
          >
            {mo === "order" ? "สั่งวันนี้" : "ไม่สั่งวันนี้"}
          </button>
        ))}
      </div>

      {mode === "order" ? (
        <>
          <div>
            <label className="mb-1 block text-xs text-muted">ส่งที่</label>
            <div className="flex gap-2">
              {(["OR", "OPD", "BOTH"] as ProfLocation[]).map((loc) => (
                <button
                  key={loc}
                  onClick={() => setLocation(loc)}
                  className="flex-1 rounded-xl border px-2 py-2 text-sm font-medium"
                  style={{
                    borderColor: location === loc ? "var(--brand)" : "var(--border)",
                    background: location === loc ? "var(--brand-soft)" : "var(--surface)",
                    color: location === loc ? "var(--brand)" : "var(--text)",
                  }}
                >
                  {loc === "BOTH" ? "ทั้งสองที่" : loc}
                </button>
              ))}
            </div>
            {location === "BOTH" ? (
              <p className="mt-1 text-[11px] text-brand">
                สั่ง 2 กล่อง (OR + OPD) — ตัดเครดิตอาจารย์ ×2
              </p>
            ) : null}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-muted">เมนู (สุ่มให้ เลือกเองได้)</label>
              <button onClick={reroll} className="text-xs font-medium text-brand">
                🎲 สุ่มใหม่
              </button>
            </div>
            <input
              value={menu}
              onChange={(e) => setMenu(e.target.value)}
              list="prof-menu"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
            <datalist id="prof-menu">
              {PROFESSOR_MENU.map((m) => (
                <option key={m.id} value={m.th}>
                  {m.en} · {m.price}
                </option>
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted">ราคา/กล่อง (บาท)</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </div>

          {err ? <p className="text-xs text-debt">{err}</p> : null}
          <button
            onClick={save}
            disabled={busy}
            className="w-full rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            ยืนยันเมนูอาจารย์ · รวม {baht(total)}
          </button>
        </>
      ) : (
        <>
          {err ? <p className="text-xs text-debt">{err}</p> : null}
          <button
            onClick={skip}
            disabled={busy}
            className="w-full rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-muted disabled:opacity-50"
          >
            ยืนยัน: วันนี้อาจารย์ไม่สั่ง
          </button>
        </>
      )}

      <p className="text-[11px] text-muted">
        {OR_DELIVERY} · {OPD_DELIVERY}
      </p>
    </div>
  );
}
