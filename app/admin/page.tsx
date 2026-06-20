"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getAllPeople,
  getBalances,
  getTopupRequests,
  addAdjustment,
  markTopupChecked,
  reverseTopup,
} from "@/lib/queries";
import type {
  Balance,
  Category,
  Person,
  TopupRequestWithPerson,
} from "@/lib/types";
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
        subtitle="ตรวจเติมเครดิต · แก้ยอด · จัดการสมาชิก"
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
    const [p, b, t] = await Promise.all([
      getAllPeople(),
      getBalances(),
      getTopupRequests(),
    ]);
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
      <BalanceEditor people={people} balances={balances} onDone={load} />
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

  const check = async (r: TopupRequestWithPerson) => {
    setBusy(r.id + "check");
    setErr(null);
    try {
      await markTopupChecked(r.id);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ผิดพลาด");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (r: TopupRequestWithPerson) => {
    if (
      !window.confirm(
        `ลบรายการเติม ${baht(Number(r.amount))} ของ ${r.people?.name ?? "?"}? เครดิตที่เพิ่มไปจะถูกหักคืน`,
      )
    )
      return;
    setBusy(r.id + "delete");
    setErr(null);
    try {
      await reverseTopup(r.id, r.person_id, Number(r.amount));
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
        เครดิตเพิ่มทันทีเมื่อผู้ใช้กด — กด &quot;ตรวจแล้ว&quot; หลังเช็ค slip กับธนาคาร
        · กด &quot;ลบ&quot; เพื่อหักเครดิตคืน (กรณีไม่ได้โอนจริง)
      </p>

      {unverified.length === 0 && verified.length === 0 ? (
        <p className="text-xs text-muted">ยังไม่มีรายการ</p>
      ) : null}

      {unverified.map((r) => (
        <div key={r.id} className="rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{r.people?.name ?? "?"}</span>
            <span className="text-sm font-bold text-credit">+{baht(Number(r.amount))}</span>
          </div>
          <p className="text-[11px] text-muted">
            {new Date(r.created_at).toLocaleString("th-TH", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => check(r)}
              disabled={busy === r.id + "check"}
              className="flex-1 rounded-xl bg-credit px-2 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              ✓ ตรวจแล้ว
            </button>
            <button
              onClick={() => remove(r)}
              disabled={busy === r.id + "delete"}
              className="rounded-xl border border-border px-3 py-2 text-xs text-debt disabled:opacity-50"
            >
              ลบ
            </button>
          </div>
        </div>
      ))}

      {err ? <p className="text-xs text-debt">{err}</p> : null}

      {verified.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] text-muted">ตรวจแล้วล่าสุด</p>
          <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {verified.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="font-medium">{r.people?.name ?? "?"}</span>
                <span>+{baht(Number(r.amount))}</span>
                <span className="text-credit">ตรวจแล้ว ✓</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function BalanceEditor({
  people,
  balances,
  onDone,
}: {
  people: Person[];
  balances: Balance[];
  onDone: () => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const balanceOf = (id: string) =>
    balances.find((b) => b.person_id === id)?.balance ?? 0;

  const startEdit = (id: string) => {
    setEditId(id);
    setValue(String(balanceOf(id)));
    setErr(null);
  };

  const save = async (p: Person) => {
    const target = Number(value);
    if (!Number.isFinite(target)) return setErr("ยอดไม่ถูกต้อง");
    const current = balanceOf(p.id);
    const delta = target - current;
    if (delta === 0) {
      setEditId(null);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await addAdjustment(p.id, delta, "ปรับยอดโดยแอดมิน");
      setEditId(null);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">แก้ยอดเครดิต (รายคน)</h2>
      <p className="text-[11px] text-muted">
        แตะ &quot;แก้&quot; แล้วใส่ยอดคงเหลือที่ถูกต้อง — ระบบจะปรับให้อัตโนมัติ
      </p>

      {CATEGORY_ORDER.map((cat) => {
        const list = people.filter((p) => p.active && p.category === cat);
        if (!list.length) return null;
        return (
          <div key={cat}>
            <p className="mb-1 px-1 text-[11px] font-medium text-muted">
              {CATEGORY_LABEL[cat]}
            </p>
            <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
              {list.map((p) => {
                const bal = balanceOf(p.id);
                const editing = editId === p.id;
                return (
                  <li key={p.id} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {p.name}
                      </span>
                      {editing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            value={value}
                            onChange={(e) =>
                              setValue(e.target.value.replace(/[^0-9.-]/g, ""))
                            }
                            inputMode="decimal"
                            autoFocus
                            className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                          />
                          <button
                            onClick={() => save(p)}
                            disabled={busy}
                            className="rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            บันทึก
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="rounded-lg border border-border px-2 py-1.5 text-xs text-muted"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-bold"
                            style={{
                              color:
                                bal < 0
                                  ? "var(--debt)"
                                  : bal > 0
                                    ? "var(--credit)"
                                    : "var(--muted)",
                            }}
                          >
                            {baht(bal)}
                          </span>
                          <button
                            onClick={() => startEdit(p.id)}
                            className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-brand"
                          >
                            แก้
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {err ? <p className="text-xs text-debt">{err}</p> : null}
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
  const [category, setCategory] = useState<Category>("R1");
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
