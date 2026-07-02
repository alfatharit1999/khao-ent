"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getClaimForDate,
  getDayState,
  getOrdersForDate,
  getPeople,
  startClaim,
  cancelDraftClaim,
  submitClaim,
  OrderWithPerson,
} from "@/lib/queries";
import type { DayState, OrderClaim, Person } from "@/lib/types";
import { baht, thaiDate, todayISO } from "@/lib/format";
import { PageHeader, SetupHint } from "../components/ui";
import { PriceRow } from "../components/PriceRow";

export default function ClaimPage() {
  const [date, setDate] = useState(todayISO());
  const [orders, setOrders] = useState<OrderWithPerson[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [day, setDay] = useState<DayState>({ date, sealed: false, prof_status: null });
  const [claim, setClaim] = useState<OrderClaim | null>(null);
  const [loading, setLoading] = useState(true);

  // form state
  const [ordererId, setOrdererId] = useState("");
  const [totalPaid, setTotalPaid] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
        setPeople(await getPeople());
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  if (!isSupabaseConfigured) {
    return (
      <main>
        <PageHeader title="เคลมเงินคนสั่ง" />
        <SetupHint />
      </main>
    );
  }

  const residentOrders = orders.filter((o) => o.people?.category !== "professor");
  // Everyone's meals (incl. the professor — he pays from his own balance like
  // anyone, and the claimer fronted his cash so it's reimbursed too).
  const grandAll = orders.reduce((s, o) => s + Number(o.price ?? 0), 0);

  const ordererName =
    people.find((p) => p.id === (claim?.orderer_id ?? ordererId))?.name ?? "";
  const ownPrice =
    claim?.orderer_id != null
      ? Number(
          residentOrders.find((o) => o.person_id === claim.orderer_id)?.price ?? 0,
        )
      : 0;
  const rolled = Math.max(0, grandAll - ownPrice);

  // Everyone (residents + professor if ordering) must be priced before claiming.
  const pendingPrice = orders.filter((o) => o.price == null);
  const allPriced = pendingPrice.length === 0;

  const locked = claim?.status === "pending" || claim?.status === "approved";

  const start = async () => {
    if (!ordererId) return setErr("เลือกคนสั่งก่อน");
    setBusy(true);
    setErr(null);
    try {
      await startClaim(date, ordererId);
      await load();
    } catch {
      setErr("เริ่มเคลมไม่สำเร็จ (อาจมีคนเริ่มไว้แล้ว)");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!claim) return;
    setBusy(true);
    setErr(null);
    try {
      await cancelDraftClaim(claim.id);
      setOrdererId("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!claim) return;
    if (!allPriced) return setErr("ใส่ราคาให้ครบทุกคนก่อน");
    const paid = totalPaid.trim() === "" ? null : Number(totalPaid);
    if (paid == null || !Number.isFinite(paid) || paid <= 0)
      return setErr("ใส่ยอดที่จ่ายจริงให้ร้าน");
    setBusy(true);
    setErr(null);
    try {
      await submitClaim({
        id: claim.id,
        orderer_id: claim.orderer_id,
        date,
        total_paid: paid,
        rolled_amount: rolled,
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "เคลมไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main>
      <PageHeader
        title="เคลมเงินคนสั่ง"
        subtitle="คนสั่งโรลเครดิตคืน (ค่าข้าวที่ออกแทนคนอื่น)"
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
          {/* Step 1 — identify the orderer */}
          {!claim ? (
            <div className="space-y-3 rounded-2xl border-2 border-brand/30 bg-surface p-4">
              <h3 className="text-sm font-semibold">ใครเป็นคนสั่งวันนี้?</h3>
              <p className="text-xs text-muted">
                คนสั่งคือคนที่ออกเงินจ่ายร้านแทนทุกคน — ระบุตัวเองก่อนเริ่มเคลม
              </p>
              <select
                value={ordererId}
                onChange={(e) => setOrdererId(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
              >
                <option value="">— เลือกชื่อคนสั่ง —</option>
                {people
                  .filter((p) => p.category !== "professor")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              {err ? <p className="text-xs text-debt">{err}</p> : null}
              <button
                onClick={start}
                disabled={busy || !ordererId}
                className="w-full rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                ฉันเป็นคนสั่ง · เริ่มเคลม
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3">
              <div>
                <p className="text-[11px] text-muted">คนสั่งวันนี้</p>
                <p className="text-sm font-semibold">{ordererName || "?"}</p>
              </div>
              {claim.status === "draft" ? (
                <button
                  onClick={cancel}
                  disabled={busy}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted"
                >
                  เปลี่ยนคนสั่ง
                </button>
              ) : (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background:
                      claim.status === "approved"
                        ? "var(--credit-soft)"
                        : "var(--brand-soft)",
                    color:
                      claim.status === "approved"
                        ? "var(--credit)"
                        : "var(--brand)",
                  }}
                >
                  {claim.status === "approved" ? "อนุมัติแล้ว ✓" : "รอแอดมินอนุมัติ"}
                </span>
              )}
            </div>
          )}

          {/* Prices — fill in each person's price (editable until submitted) */}
          {orders.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="border-b border-border bg-background px-4 py-2 text-sm font-semibold">
                ราคาแต่ละคน
              </div>
              <ul className="divide-y divide-border">
                {orders.map((o) => (
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
          ) : (
            <p className="py-4 text-center text-sm text-muted">
              ยังไม่มีออเดอร์วันนี้
            </p>
          )}

          {!allPriced && claim ? (
            <p className="rounded-xl bg-debt-soft px-3 py-2 text-xs text-debt">
              ⏳ ยังมี {pendingPrice.length} คนที่ไม่มีราคา — ใส่ให้ครบก่อนถึงจะเคลมได้
            </p>
          ) : null}

          {/* Step 2 — record total paid + roll over (draft only) */}
          {claim?.status === "draft" ? (
            <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold">ยอดที่จ่ายร้านจริง</h3>
              <input
                value={totalPaid}
                onChange={(e) => setTotalPaid(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="เช่น 1240"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
              />
              <div className="rounded-xl bg-background p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">ค่าข้าวคนอื่น (ไม่รวมข้าวตัวเอง)</span>
                  <span className="font-semibold text-credit">{baht(rolled)}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  ยอดนี้จะโรลเข้าเครดิตของ <b>{ordererName || "คนสั่ง"}</b> ทันที
                  (ข้าวตัวเองถือว่าจ่ายเองแล้ว · รวมข้าวอาจารย์ที่ออกแทนด้วย)
                </p>
              </div>
              {err ? <p className="text-xs text-debt">{err}</p> : null}
              <button
                onClick={submit}
                disabled={busy || !allPriced}
                className="w-full rounded-xl bg-brand px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                ✅ ยืนยันเคลม · โรล {baht(rolled)} เข้าเครดิต
              </button>
              <p className="text-[11px] text-muted text-center">
                ยืนยันแล้วแก้ไม่ได้ — ถ้าผิดให้แอดมิน revert
              </p>
            </div>
          ) : null}

          {/* Submitted summary */}
          {locked && claim ? (
            <div className="space-y-1 rounded-2xl border border-border bg-surface p-4">
              <h3 className="mb-1 text-sm font-semibold">สรุปการเคลม</h3>
              <div className="flex justify-between text-sm">
                <span className="text-muted">คนสั่ง</span>
                <span className="font-semibold">{ordererName || "?"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">จ่ายร้านจริง</span>
                <span>{claim.total_paid != null ? baht(Number(claim.total_paid)) : "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">โรลเข้าเครดิต</span>
                <span className="font-semibold text-credit">
                  {claim.rolled_amount != null ? baht(Number(claim.rolled_amount)) : "—"}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted">
                {claim.status === "approved"
                  ? "แอดมินอนุมัติแล้ว"
                  : "รอแอดมินตรวจ/อนุมัติในแท็บแอดมิน"}
                {" · "}
                {thaiDate(date)}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}
