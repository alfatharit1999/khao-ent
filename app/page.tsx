"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  getBalances,
  getOrdersForDate,
  getPeople,
  getSettings,
  OrderWithPerson,
} from "@/lib/queries";
import type { Balance, Person } from "@/lib/types";
import { baht, thaiDate, todayISO } from "@/lib/format";
import { useMe } from "@/lib/useMe";
import { PageHeader, SetupHint } from "./components/ui";
import { NamePicker } from "./components/NamePicker";
import { OrderForm } from "./components/OrderForm";
import { TodayBoard } from "./components/TodayBoard";

export default function Home() {
  const date = todayISO();
  const [me, setMe] = useMe();
  const [people, setPeople] = useState<Person[]>([]);
  const [orders, setOrders] = useState<OrderWithPerson[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [weekLabel, setWeekLabel] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const reloadOrders = useCallback(async () => {
    const [o, b] = await Promise.all([getOrdersForDate(date), getBalances()]);
    setOrders(o);
    setBalances(b);
  }, [date]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const [p, s] = await Promise.all([getPeople(), getSettings()]);
        if (!active) return;
        setPeople(p);
        setWeekLabel(s.week_label ?? "");
        await reloadOrders();
      } finally {
        if (active) setLoading(false);
      }
    })();

    // live board updates
    const supabase = getSupabase();
    const channel = supabase
      ?.channel("orders-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => reloadOrders(),
      )
      .subscribe();

    return () => {
      active = false;
      if (channel) supabase?.removeChannel(channel);
    };
  }, [reloadOrders]);

  if (!isSupabaseConfigured) {
    return (
      <main>
        <PageHeader title="สั่งข้าว ENT" />
        <SetupHint />
      </main>
    );
  }

  const mePerson = people.find((p) => p.id === me) ?? null;
  const myBalance = balances.find((b) => b.person_id === me)?.balance ?? 0;
  const myOrder = orders.find((o) => o.person_id === me);

  return (
    <main>
      <PageHeader
        title="สั่งข้าว ENT"
        subtitle={`${thaiDate(date)}${weekLabel ? ` · สัปดาห์ ${weekLabel}` : ""}`}
        right={
          mePerson ? (
            <button
              onClick={() => setMe(null)}
              className="rounded-full border border-border px-3 py-1 text-xs"
            >
              {mePerson.name} ⌄
            </button>
          ) : null
        }
      />

      {loading ? (
        <p className="p-8 text-center text-sm text-muted">กำลังโหลด…</p>
      ) : !mePerson ? (
        <NamePicker people={people} onPick={setMe} />
      ) : (
        <div className="space-y-4 p-4">
          <div
            className="rounded-2xl p-4"
            style={{
              background: myBalance < 0 ? "var(--debt-soft)" : "var(--credit-soft)",
            }}
          >
            <div className="text-xs text-muted">เครดิตคงเหลือของคุณ</div>
            <div
              className="text-2xl font-bold"
              style={{ color: myBalance < 0 ? "var(--debt)" : "var(--credit)" }}
            >
              {baht(myBalance)}
            </div>
            {myBalance < 0 ? (
              <div className="mt-0.5 text-xs text-debt">
                ติดลบอยู่ — เติมเงินกับพี่บัญชีได้เลย
              </div>
            ) : null}
          </div>

          <OrderForm
            me={mePerson}
            existing={myOrder}
            date={date}
            onSaved={reloadOrders}
          />

          <TodayBoard orders={orders} meId={me} />
        </div>
      )}
    </main>
  );
}
