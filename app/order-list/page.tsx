"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  addFrontCredit,
  getOrdersForDate,
  getPeople,
  getSettings,
  OrderWithPerson,
} from "@/lib/queries";
import type { Person } from "@/lib/types";
import { baht, thaiDate, todayISO } from "@/lib/format";
import { PageHeader, SetupHint } from "../components/ui";

type LocKey = "OR" | "OPD" | "ไม่ระบุ";
const LOC_ORDER: LocKey[] = ["OR", "OPD", "ไม่ระบุ"];

export default function OrderListPage() {
  const [date, setDate] = useState(todayISO());
  const [orders, setOrders] = useState<OrderWithPerson[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const o = await getOrdersForDate(date);
    setOrders(o);
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

  const byLoc = (loc: LocKey) =>
    orders.filter((o) => (o.location ?? "ไม่ระบุ") === loc);
  const grand = orders.reduce((s, o) => s + Number(o.price), 0);
  // What the fronter actually lays out (อ.ไพบูลย์'s food is covered by his deposit).
  const grandExclProf = orders
    .filter((o) => o.people?.category !== "professor")
    .reduce((s, o) => s + Number(o.price), 0);

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
        lines.push(`${o.people?.name}: ${o.menu_item ?? "-"} (${o.price})`),
      );
    });
    lines.push("");
    lines.push(`รวม ${orders.length} รายการ = ${baht(grand)}`);
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
          {orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              ยังไม่มีออเดอร์วันนี้
            </p>
          ) : (
            <>
              {LOC_ORDER.map((loc) => {
                const list = byLoc(loc);
                if (!list.length) return null;
                const sub = list.reduce((s, o) => s + Number(o.price), 0);
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
                        <li key={o.id} className="flex gap-3 px-4 py-2.5">
                          <span className="w-20 shrink-0 truncate text-sm font-medium">
                            {o.people?.name}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-muted">
                            {o.menu_item}
                          </span>
                          <span className="shrink-0 text-sm font-semibold">
                            {baht(Number(o.price))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              <div className="flex items-center justify-between rounded-2xl bg-brand-soft px-4 py-3">
                <span className="text-sm font-medium">รวมทั้งหมด</span>
                <span className="text-lg font-bold text-brand">
                  {baht(grand)}
                </span>
              </div>

              <button
                onClick={copy}
                className="w-full rounded-xl bg-brand px-3 py-3 text-sm font-semibold text-white active:scale-95"
              >
                {copied ? "คัดลอกแล้ว ✓" : "คัดลอกรายการไปส่งร้าน"}
              </button>

              <FrontPanel
                people={people}
                date={date}
                grand={grandExclProf}
                onDone={load}
              />
            </>
          )}
        </div>
      )}
    </main>
  );
}

function FrontPanel({
  people,
  date,
  grand,
  onDone,
}: {
  people: Person[];
  date: string;
  grand: number;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [personId, setPersonId] = useState("");
  const [amount, setAmount] = useState(String(grand));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setAmount(String(grand)), [grand]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-border px-3 py-3 text-sm font-medium text-muted"
      >
        💳 ใครสำรองจ่ายวันนี้? (โรลเข้าเครดิต)
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
            คนที่สำรองจ่ายค่าข้าวที่ห้อง treatment จะได้เครดิตคืนเท่ายอดที่จ่าย
            (ไม่ต้องโอนเงินสด) ยอดนี้<b>ไม่รวมข้าวอาจารย์</b> — และค่าข้าวของตัวเอง
            จะถูกหักตามปกติ สรุปแล้วได้เครดิตเท่าที่ออกแทนคนอื่นเป๊ะ
          </p>
          <div>
            <label className="mb-1 block text-xs text-muted">ใครสำรองจ่าย</label>
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              <option value="">— เลือกชื่อ —</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">
              ยอดที่สำรองจ่าย (บาท) — ไม่รวมข้าวอาจารย์
            </label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
          </div>
          {err ? <p className="text-xs text-debt">{err}</p> : null}
          {msg ? <p className="text-xs text-credit">{msg}</p> : null}
          <button
            disabled={busy || !personId}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              setMsg(null);
              try {
                await addFrontCredit(personId, Number(amount), date);
                setMsg("บันทึกแล้ว — โรลเข้าเครดิตเรียบร้อย");
                setPersonId("");
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
