"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  addFrontCredit,
  getDayState,
  getFrontCreditForDate,
  getOrdersForDate,
  getPeople,
  getSettings,
  setProfessorMeal,
  setSeal,
  skipProfessor,
  updateOrderPrice,
  OrderWithPerson,
} from "@/lib/queries";
import type { DayState, Person } from "@/lib/types";
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

type LocKey = "OR" | "OPD" | "ไม่ระบุ";
const LOC_ORDER: LocKey[] = ["OR", "OPD", "ไม่ระบุ"];

export default function OrderListPage() {
  const [date, setDate] = useState(todayISO());
  const [orders, setOrders] = useState<OrderWithPerson[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [day, setDay] = useState<DayState>({ date, sealed: false, prof_status: null });
  const [frontCredit, setFrontCredit] = useState<{ person_id: string; amount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const [o, d, fc] = await Promise.all([
      getOrdersForDate(date),
      getDayState(date),
      getFrontCreditForDate(date),
    ]);
    setOrders(o);
    setDay(d);
    setFrontCredit(fc);
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
  const grandExclProf = residentOrders.reduce(
    (s, o) => s + Number(o.price ?? 0),
    0,
  );

  // Prices the orderer still has to fill in after the restaurant bill arrives.
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

    // Professor — special handling.
    lines.push("");
    lines.push(`⭐ อ.ไพบูลย์ — ${PROFESSOR_BOX_NOTE} (${PROFESSOR_RESTRICTIONS})`);
    if (day.prof_status === "skip" || !profOrder) {
      lines.push("  วันนี้ไม่สั่ง");
    } else {
      const unit =
        Number(profOrder.price) / (profOrder.location === "BOTH" ? 2 : 1);
      if (profOrder.location === "OR" || profOrder.location === "BOTH")
        lines.push(`  • OR: ${profOrder.menu_item} (${unit})`);
      if (profOrder.location === "OPD" || profOrder.location === "BOTH")
        lines.push(`  • OPD: ${profOrder.menu_item} (${unit})`);
    }

    lines.push("");
    lines.push(`รวม ${totalBoxes} กล่อง = ${baht(grand)}`);
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

  // All resident prices filled + professor confirmed + fronter recorded → seal.
  const canSeal =
    allPriced && day.prof_status !== null && frontCredit !== null;
  const toggleSeal = async () => {
    await setSeal(date, !day.sealed);
    await load();
  };

  return (
    <main>
      <PageHeader
        title="รวมออเดอร์"
        subtitle="รายการที่ต้องสั่งร้าน แยกตาม OR / OPD"
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
                        sealed={day.sealed}
                        onSaved={load}
                      />
                    ))}
                  </ul>
                </div>
              );
            })
          )}

          {!allPriced ? (
            <p className="rounded-xl bg-debt-soft px-3 py-2 text-xs text-debt">
              ⏳ ยังมี {pendingPrice.length} เมนูที่ไม่มีราคา — หลังร้านคิดเงิน
              ใส่ราคาให้แต่ละคนก่อน (แตะที่ &quot;ใส่ราคา&quot;) ถึงจะปิดออเดอร์ได้
            </p>
          ) : null}

          <div className="flex items-center justify-between rounded-2xl bg-brand-soft px-4 py-3">
            <span className="text-sm font-medium">รวม {totalBoxes} กล่อง</span>
            <span className="text-lg font-bold text-brand">{baht(grand)}</span>
          </div>

          <FrontPanel
            people={people}
            date={date}
            grandExclProf={grandExclProf}
            ownPrice={Object.fromEntries(
              residentOrders.map((o) => [o.person_id, Number(o.price ?? 0)]),
            )}
            existing={frontCredit}
            onDone={load}
          />

          {/* Seal gate */}
          <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
            {!allPriced ? (
              <p className="text-xs text-debt">
                ใส่ราคาให้ครบทุกเมนูก่อน ({pendingPrice.length} เมนูยังไม่มีราคา) ถึงจะปิดออเดอร์ได้
              </p>
            ) : day.prof_status === null ? (
              <p className="text-xs text-debt">
                ยืนยันสถานะข้าวอาจารย์ด้านบนก่อน (สั่ง หรือ ไม่สั่ง) ถึงจะปิดออเดอร์ได้
              </p>
            ) : !frontCredit ? (
              <p className="text-xs text-debt">
                ระบุผู้สำรองจ่ายด้านบนก่อนถึงจะปิดออเดอร์ได้
              </p>
            ) : null}
            <button
              onClick={toggleSeal}
              disabled={!canSeal}
              className="w-full rounded-xl px-3 py-3 text-sm font-semibold disabled:opacity-50"
              style={{
                background: day.sealed ? "var(--surface)" : "var(--credit)",
                color: day.sealed ? "var(--muted)" : "#fff",
                border: day.sealed ? "1px solid var(--border)" : "none",
              }}
            >
              {day.sealed ? "🔓 แก้ไขออเดอร์ (ปลดล็อก)" : "🔒 ปิดออเดอร์ (Seal)"}
            </button>

            <button
              onClick={copy}
              disabled={!day.sealed}
              className="w-full rounded-xl bg-brand px-3 py-3 text-sm font-semibold text-white active:scale-95 disabled:opacity-40"
            >
              {day.sealed ? (copied ? "คัดลอกแล้ว ✓" : "📋 คัดลอกรายการไปส่งร้าน") : "🔒 ปิดออเดอร์ก่อนถึงจะคัดลอกได้"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

/** One resident's order row — the orderer taps to fill in the price. */
function PriceRow({
  order,
  date,
  sealed,
  onSaved,
}: {
  order: OrderWithPerson;
  date: string;
  sealed: boolean;
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
      {sealed ? (
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

function ProfessorCard({
  professorId,
  date,
  existing,
  day,
  onChanged,
}: {
  professorId: string;
  date: string;
  existing: OrderWithPerson | undefined;
  day: DayState;
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
        Number(existing.price) / (existing.location === "BOTH" ? 2 : 1);
      setPrice(String(unit));
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

  // Read-only summary once the day is sealed.
  if (day.sealed) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="mb-1 font-semibold">⭐ ข้าวอาจารย์ไพบูลย์</h3>
        {day.prof_status === "skip" || !existing ? (
          <p className="text-sm text-muted">วันนี้ไม่สั่ง</p>
        ) : (
          <p className="text-sm">
            {existing.location === "BOTH" ? "OR + OPD" : existing.location} ·{" "}
            {existing.menu_item} —{" "}
            <span className="font-semibold">{baht(Number(existing.price))}</span>
          </p>
        )}
        <p className="mt-1 text-xs text-muted">ปิดออเดอร์แล้ว — ปลดล็อกด้านล่างเพื่อแก้</p>
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

function FrontPanel({
  people,
  date,
  grandExclProf,
  ownPrice,
  existing,
  onDone,
}: {
  people: Person[];
  date: string;
  grandExclProf: number;
  ownPrice: Record<string, number>;
  existing: { person_id: string; amount: number } | null;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [personId, setPersonId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Default = others' meals only: everyone's order (minus professor) minus the
  // selected fronter's own meal (their own is settled, not reimbursed).
  const suggested = grandExclProf - (personId ? ownPrice[personId] ?? 0 : 0);
  useEffect(() => {
    setAmount(String(suggested));
  }, [suggested]);

  if (existing) {
    const fronter = people.find((p) => p.id === existing.person_id);
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">💳 ผู้สำรองจ่ายวันนี้</h3>
          <span className="rounded-full bg-credit-soft px-2 py-0.5 text-[10px] font-medium text-credit">
            โรลเข้าเครดิตแล้ว ✓
          </span>
        </div>
        <p className="mt-1 text-sm">
          <span className="font-medium">{fronter?.name ?? "?"}</span>
          {" — "}
          <span className="font-semibold">{baht(existing.amount)}</span>
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-debt/40 bg-debt-soft px-3 py-3 text-sm font-semibold text-debt"
      >
        💳 ระบุผู้สำรองจ่ายวันนี้ก่อน (โรลเข้าเครดิต)
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">บันทึกคนสำรองจ่าย</h3>
        <button onClick={() => setOpen(false)} className="text-xs text-muted">
          ปิด
        </button>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-xs text-muted">
          คนที่สำรองจ่ายจะได้เครดิตคืน<b>เฉพาะส่วนที่ออกแทนคนอื่น</b> (ไม่ต้องโอนเงินสด)
          — ยอดนี้ตัด<b>ข้าวของตัวเอง</b>และ<b>ข้าวอาจารย์</b>ออกแล้ว
          ข้าวของตัวเองถือว่าจ่ายเองไปแล้ว ไม่นับเป็นหนี้ซ้ำ
        </p>
        <div>
          <label className="mb-1 block text-xs text-muted">ใครสำรองจ่าย</label>
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
          >
            <option value="">— เลือกชื่อ —</option>
            {people
              .filter((p) => p.category !== "professor")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">
            ยอดเครดิตคืน (บาท) — ตัดข้าวตัวเอง + ข้าวอาจารย์แล้ว
          </label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
          />
        </div>
        {err ? <p className="text-xs text-debt">{err}</p> : null}
        <button
          disabled={busy || !personId}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              await addFrontCredit(personId, Number(amount), date);
              onDone();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "ผิดพลาด");
            } finally {
              setBusy(false);
            }
          }}
          className="w-full rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          บันทึก & โรลเข้าเครดิต
        </button>
      </div>
    </div>
  );
}
