"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getFundEntries } from "@/lib/queries";
import type { FundEntry } from "@/lib/types";
import { adminFetch } from "@/lib/adminClient";
import { baht, thaiDate, todayISO } from "@/lib/format";
import { PageHeader, SetupHint } from "../components/ui";
import { AdminGate } from "../components/AdminGate";

export default function FundPage() {
  const [entries, setEntries] = useState<FundEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setEntries(await getFundEntries());
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    load().finally(() => setLoading(false));
  }, [load]);

  if (!isSupabaseConfigured) {
    return (
      <main>
        <PageHeader title="กองกลาง" />
        <SetupHint />
      </main>
    );
  }

  const totalIncome = entries.reduce((s, e) => s + Number(e.income), 0);
  const totalExpense = entries.reduce((s, e) => s + Number(e.expense), 0);
  const balance = totalIncome - totalExpense;

  // running balance per row (oldest → newest), then show newest first
  let running = 0;
  const withRunning = entries.map((e) => {
    running += Number(e.income) - Number(e.expense);
    return { ...e, running };
  });
  const rows = [...withRunning].reverse();

  return (
    <main>
      <PageHeader
        title="กองกลาง"
        subtitle="บัญชีเงินส่วนกลางของรุ่น"
        right={
          <button
            onClick={() => setAdding((v) => !v)}
            className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white"
          >
            {adding ? "ปิด" : "+ เพิ่ม"}
          </button>
        }
      />

      {loading ? (
        <p className="p-8 text-center text-sm text-muted">กำลังโหลด…</p>
      ) : (
        <div className="space-y-4 p-4">
          <div className="rounded-2xl bg-surface border border-border p-4">
            <div className="text-xs text-muted">ยอดคงเหลือกองกลาง</div>
            <div className="text-2xl font-bold text-brand">{baht(balance)}</div>
            <div className="mt-1 flex gap-4 text-xs text-muted">
              <span>รายรับรวม {baht(totalIncome)}</span>
              <span>รายจ่ายรวม {baht(totalExpense)}</span>
            </div>
          </div>

          {adding ? <AdminGate><AddFundForm onDone={load} /></AdminGate> : null}

          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <ul className="divide-y divide-border">
              {rows.map((e) => {
                const isIncome = Number(e.income) > 0;
                return (
                  <li key={e.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {e.description ?? (isIncome ? "รายรับ" : "รายจ่าย")}
                        </div>
                        <div className="text-xs text-muted">
                          {thaiDate(e.date)}
                          {e.recipient ? ` · ${e.recipient}` : ""}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className="text-sm font-semibold"
                          style={{ color: isIncome ? "var(--credit)" : "var(--debt)" }}
                        >
                          {isIncome
                            ? `+${baht(Number(e.income))}`
                            : `−${baht(Number(e.expense))}`}
                        </div>
                        <div className="text-[10px] text-muted">
                          คงเหลือ {baht(e.running)}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}

function AddFundForm({ onDone }: { onDone: () => void }) {
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await adminFetch("/api/admin/fund-entry", {
        date,
        description,
        income: kind === "income" ? Number(amount) : 0,
        expense: kind === "expense" ? Number(amount) : 0,
        recipient: recipient || null,
      });
      setDescription("");
      setAmount("");
      setRecipient("");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ผิดพลาด");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold">เพิ่มรายการกองกลาง</h3>
      <div className="flex gap-2">
        {(["expense", "income"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className="flex-1 rounded-xl border px-3 py-2 text-sm font-medium"
            style={{
              borderColor: kind === k ? "var(--brand)" : "var(--border)",
              background: kind === k ? "var(--brand-soft)" : "var(--surface)",
              color: kind === k ? "var(--brand)" : "var(--text)",
            }}
          >
            {k === "expense" ? "รายจ่าย" : "รายรับ"}
          </button>
        ))}
      </div>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="รายการ เช่น ค่าสบู่"
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        inputMode="decimal"
        placeholder="จำนวนเงิน"
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
      />
      <input
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        placeholder="ผู้รับ/ผู้โอน (ถ้ามี)"
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
      />
      {err ? <p className="text-xs text-debt">{err}</p> : null}
      <button
        onClick={submit}
        disabled={busy || !amount}
        className="w-full rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        บันทึก
      </button>
    </div>
  );
}
