"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getAllPeople, getBalances, getTopupRequests } from "@/lib/queries";
import type { Balance, Category, Person, TopupRequestWithPerson } from "@/lib/types";
import { adminFetch, setPin } from "@/lib/adminClient";
import { CATEGORY_ORDER, CATEGORY_LABEL, CATEGORY_SHORT } from "@/lib/categories";
import { baht } from "@/lib/format";
import { PageHeader, SetupHint } from "../components/ui";
import { AdminGate } from "../components/AdminGate";

export default function AdminPage() {
  if (!isSupabaseConfigured) {
    return (
      <main>
        <PageHeader title="แอดมิน" />
        <SetupHint />
      </main>
    );
  }
  return (
    <main>
      <PageHeader
        title="แอดมิน"
        subtitle="เติมเงิน · ปรับเครดิต · จัดการสมาชิก"
        right={
          <button
            onClick={() => {
              setPin(null);
              location.reload();
            }}
            className="rounded-full border border-border px-3 py-1 text-xs"
          >
            ออก
          </button>
        }
      />
      <AdminGate>
        <AdminPanel />
      </AdminGate>
    </main>
  );
}

function AdminPanel() {
  const [people, setPeople] = useState<Person[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [topupReqs, setTopupReqs] = useState<TopupRequestWithPerson[]>([]);

  const load = useCallback(async () => {
    const [p, b, t] = await Promise.all([getAllPeople(), getBalances(), getTopupRequests()]);
    setPeople(p);
    setBalances(b);
    setTopupReqs(t);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5 p-4">
      <TopupRequests requests={topupReqs} onDone={load} />
      <CreditForm people={people} onDone={load} />
      <BalancesMini balances={balances} />
      <PeopleManager people={people} onDone={load} />
    </div>
  );
}

function TopupRequests({
  requests,
  onDone,
}: {
  requests: TopupRequestWithPerson[];
  onDone: () => void;
}) {
  const unverified = requests.filter((r) => r.status === "pending");
  const verified = requests.filter((r) => r.status === "approved").slice(0, 8);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const act = async (action: "check" | "delete", id: string) => {
    setBusy(id + action);
    setErr(null);
    try {
      await adminFetch("/api/admin/topup-request", { action, id });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ผิดพลาด");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">
        บันทึกเติมเครดิต
        {unverified.length > 0 && (
          <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">
            {unverified.length} ยังไม่ตรวจ
          </span>
        )}
      </h2>
      <p className="text-[11px] text-muted">
        เครดิตเพิ่มทันทีเมื่อผู้ใช้กด — กด "ตรวจแล้ว" หลังเช็ค slip กับธนาคาร
      </p>

      {unverified.length === 0 && verified.length === 0 ? (
        <p className="text-xs text-muted">ยังไม่มีรายการ</p>
      ) : null}

      {/* Unverified — needs admin to cross-check with bank */}
      {unverified.map((r) => (
        <div key={r.id} className="rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{r.people?.name ?? "?"}</span>
            <span className="text-sm font-bold text-credit">+฿{Number(r.amount).toFixed(0)}</span>
          </div>
          <p className="text-[11px] text-muted">
            {new Date(r.created_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => act("check", r.id)}
              disabled={busy === r.id + "check"}
              className="flex-1 rounded-xl bg-credit px-2 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              ✓ ตรวจแล้ว
            </button>
            <button
              onClick={() => act("delete", r.id)}
              disabled={busy === r.id + "delete"}
              className="rounded-xl border border-border px-3 py-2 text-xs text-debt disabled:opacity-50"
            >
              ลบ
            </button>
          </div>
        </div>
      ))}

      {err ? <p className="text-xs text-debt">{err}</p> : null}

      {/* Recently verified */}
      {verified.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] text-muted">ตรวจแล้วล่าสุด</p>
          <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {verified.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="font-medium">{r.people?.name ?? "?"}</span>
                <span>+฿{Number(r.amount).toFixed(0)}</span>
                <span className="text-credit">ตรวจแล้ว ✓</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const CREDIT_KINDS = [
  { key: "topup", label: "เติมเงิน", sign: 1, hint: "ลูกค้าโอนเงินเข้ามา (+)" },
  { key: "settlement", label: "จ่ายคืนสด", sign: -1, hint: "เราจ่ายเงินสดคืนให้ (−)" },
  { key: "adjustment", label: "ปรับยอด", sign: 1, hint: "แก้ไขยอดด้วยมือ (+/−)" },
] as const;

function CreditForm({
  people,
  onDone,
}: {
  people: Person[];
  onDone: () => void;
}) {
  const [personId, setPersonId] = useState("");
  const [kind, setKind] = useState<(typeof CREDIT_KINDS)[number]["key"]>("topup");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const cfg = CREDIT_KINDS.find((k) => k.key === kind)!;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const mag = Number(amount);
      const signed = kind === "adjustment" ? mag : Math.abs(mag) * cfg.sign;
      await adminFetch("/api/admin/credit", {
        person_id: personId,
        type: kind,
        amount: signed,
        note: note || null,
      });
      setMsg("บันทึกเรียบร้อย");
      setAmount("");
      setNote("");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ผิดพลาด");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">เติมเงิน / ปรับเครดิต</h2>
      <select
        value={personId}
        onChange={(e) => setPersonId(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
      >
        <option value="">— เลือกชื่อ —</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.category === "professor" ? " (อาจารย์)" : ""}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        {CREDIT_KINDS.map((k) => (
          <button
            key={k.key}
            onClick={() => setKind(k.key)}
            className="flex-1 rounded-xl border px-2 py-2 text-xs font-medium"
            style={{
              borderColor: kind === k.key ? "var(--brand)" : "var(--border)",
              background: kind === k.key ? "var(--brand-soft)" : "var(--surface)",
              color: kind === k.key ? "var(--brand)" : "var(--text)",
            }}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">{cfg.hint}</p>

      <input
        value={amount}
        onChange={(e) =>
          setAmount(
            kind === "adjustment"
              ? e.target.value.replace(/[^0-9.-]/g, "")
              : e.target.value.replace(/[^0-9.]/g, ""),
          )
        }
        inputMode="decimal"
        placeholder={kind === "adjustment" ? "จำนวน (ใส่ − เพื่อหัก)" : "จำนวนเงิน"}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="หมายเหตุ (ถ้ามี)"
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
      />
      {err ? <p className="text-xs text-debt">{err}</p> : null}
      {msg ? <p className="text-xs text-credit">{msg}</p> : null}
      <button
        onClick={submit}
        disabled={busy || !personId || !amount}
        className="w-full rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        บันทึก
      </button>
      <p className="text-[11px] text-muted">
        ตั้งเงินฝากอาจารย์: เลือก อ.ไพบูลย์ แล้วใช้ “ปรับยอด” ใส่ยอดคงเหลือที่ต้องการ
      </p>
    </section>
  );
}

function BalancesMini({ balances }: { balances: Balance[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-2 text-sm font-semibold">
        ยอดคงเหลือทุกคน
      </div>
      <ul className="divide-y divide-border">
        {balances.map((b) => (
          <li
            key={b.person_id}
            className="flex items-center justify-between px-4 py-2 text-sm"
          >
            <span>{b.name}</span>
            <span
              className="font-semibold"
              style={{
                color:
                  b.balance < 0
                    ? "var(--debt)"
                    : b.balance > 0
                      ? "var(--credit)"
                      : "var(--muted)",
              }}
            >
              {baht(b.balance)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PeopleManager({
  people,
  onDone,
}: {
  people: Person[];
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("R2");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await adminFetch("/api/admin/people", {
        action: "create",
        name,
        category,
      });
      setName("");
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "เพิ่มไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (p: Person) => {
    setErr(null);
    try {
      await adminFetch("/api/admin/people", {
        action: "update",
        id: p.id,
        active: !p.active,
      });
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "อัปเดตไม่สำเร็จ");
    }
  };

  const remove = async (p: Person) => {
    if (
      !window.confirm(
        `ลบ "${p.name}" ถาวร? ออเดอร์และเครดิตทั้งหมดของคนนี้จะถูกลบด้วย`,
      )
    )
      return;
    setErr(null);
    try {
      await adminFetch("/api/admin/people", { action: "delete", id: p.id });
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">จัดการสมาชิก</h2>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ชื่อใหม่"
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="rounded-xl border border-border bg-background px-2 py-2 text-sm"
        >
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <button
          onClick={add}
          disabled={busy || !name.trim()}
          className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          เพิ่ม
        </button>
      </div>
      {err ? <p className="text-xs text-debt">{err}</p> : null}
      <ul className="divide-y divide-border">
        {people.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between py-2 text-sm"
          >
            <span className={p.active ? "" : "text-muted line-through"}>
              {p.name}{" "}
              <span className="text-xs text-muted no-underline">
                {CATEGORY_SHORT[p.category]}
              </span>
            </span>
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={() => toggle(p)}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted"
              >
                {p.active ? "ซ่อน" : "แสดง"}
              </button>
              <button
                onClick={() => remove(p)}
                className="rounded-full border border-border px-3 py-1 text-xs text-debt"
              >
                ลบ
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted">
        “ซ่อน” = พักไว้ไม่ให้เลือกสั่ง แต่เก็บประวัติ · “ลบ” = ลบถาวรพร้อมออเดอร์/เครดิตทั้งหมด
      </p>
    </section>
  );
}
