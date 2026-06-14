"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getBalances, getSpendBetween } from "@/lib/queries";
import type { Balance } from "@/lib/types";
import { baht, weekRange } from "@/lib/format";
import { PageHeader, SetupHint } from "../components/ui";

const GROUP_LABEL: Record<Balance["kind"], string> = {
  resident: "Resident ปี 1",
  senior: "พี่ ๆ",
  professor: "อาจารย์ (เงินฝากคงเหลือ)",
};

export default function SummaryPage() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [week, setWeek] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { start, end } = weekRange();
        const [b, w] = await Promise.all([
          getBalances(),
          getSpendBetween(start, end),
        ]);
        setBalances(b);
        setWeek(w);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <main>
        <PageHeader title="เครดิต & หนี้" />
        <SetupHint />
      </main>
    );
  }

  // Professor sits in his own deposit world — exclude from group credit/debt totals.
  const members = balances.filter((b) => b.kind !== "professor");
  const totalCredit = members
    .filter((b) => b.balance > 0)
    .reduce((s, b) => s + b.balance, 0);
  const totalDebt = members
    .filter((b) => b.balance < 0)
    .reduce((s, b) => s + b.balance, 0);

  const groups: Balance["kind"][] = ["resident", "senior", "professor"];

  return (
    <main>
      <PageHeader title="เครดิต & หนี้" subtitle="ยอดคงเหลือของแต่ละคน" />

      {loading ? (
        <p className="p-8 text-center text-sm text-muted">กำลังโหลด…</p>
      ) : (
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-credit-soft p-3">
              <div className="text-xs text-muted">รวมเครดิตที่เหลือ</div>
              <div className="text-lg font-bold text-credit">
                {baht(totalCredit)}
              </div>
            </div>
            <div className="rounded-2xl bg-debt-soft p-3">
              <div className="text-xs text-muted">รวมที่ติดหนี้</div>
              <div className="text-lg font-bold text-debt">
                {baht(totalDebt)}
              </div>
            </div>
          </div>

          {groups.map((g) => {
            const list = balances.filter((b) => b.kind === g);
            if (!list.length) return null;
            return (
              <div key={g}>
                <div className="mb-2 px-1 text-xs font-medium text-muted">
                  {GROUP_LABEL[g]}
                </div>
                <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                  <ul className="divide-y divide-border">
                    {list.map((b) => (
                      <li
                        key={b.person_id}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {b.name}
                          </div>
                          <div className="text-xs text-muted">
                            สัปดาห์นี้ {baht(week[b.person_id] ?? 0)}
                          </div>
                        </div>
                        <div
                          className="shrink-0 text-right text-base font-bold"
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
                          <div className="text-[10px] font-normal text-muted">
                            {b.balance < 0
                              ? "ติดหนี้"
                              : b.balance > 0
                                ? "เครดิตเหลือ"
                                : "พอดี"}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
