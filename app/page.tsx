"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  createPerson,
  getBalances,
  getOrdersForDate,
  getPeople,
  getSettings,
  OrderWithPerson,
} from "@/lib/queries";
import type { Balance, Category, Person } from "@/lib/types";
import { baht, thaiDate, todayISO } from "@/lib/format";
import { useMe } from "@/lib/useMe";
import { PageHeader, SetupHint } from "./components/ui";
import { NamePicker } from "./components/NamePicker";
import { OrderForm } from "./components/OrderForm";
import { TodayBoard } from "./components/TodayBoard";
import { DateStrip } from "./components/DateStrip";

export default function Home() {
  const today = todayISO();
  const [date, setDate] = useState(today);
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

  const handleCreate = useCallback(
    async (name: string, category: Category) => {
      const id = await createPerson(name, category);
      setPeople(await getPeople());
      setMe(id);
    },
    [setMe],
  );

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
              className="rounded-full border border-border px-3 py-1 text-xs font-medium"
            >
              ← เปลี่ยนชื่อ
            </button>
          ) : null
        }
      />

      {loading ? (
        <p className="p-8 text-center text-sm text-muted">กำลังโหลด…</p>
      ) : !mePerson ? (
        <NamePicker people={people} onPick={setMe} onCreate={handleCreate} />
      ) : (
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface border border-border px-4 py-3">
            <span className="text-sm font-medium">{mePerson.name}</span>
            <div className="text-right">
              <div className="text-[11px] text-muted">เครดิตคงเหลือ</div>
              <div
                className="text-xl font-bold leading-tight"
                style={{ color: myBalance < 0 ? "var(--debt)" : "var(--credit)" }}
              >
                {baht(myBalance)}
              </div>
            </div>
          </div>
          {myBalance < 0 ? (
            <p className="-mt-2 px-1 text-xs text-debt">
              ติดลบอยู่ — เติมเงินกับพี่บัญชีได้เลย
            </p>
          ) : null}

          <DateStrip selected={date} onSelect={setDate} />

          {date !== today ? (
            <p className="rounded-xl bg-brand-soft px-3 py-2 text-xs text-brand">
              พรีออเดอร์สำหรับ {thaiDate(date)} — ยังไม่ตัดเครดิตจนถึงวันนั้น
              แก้/ยกเลิกก่อนได้ไม่มีปัญหา
            </p>
          ) : null}

          <OrderForm
            me={mePerson}
            existing={myOrder}
            date={date}
            dateLabel={date === today ? "วันนี้" : thaiDate(date)}
            onSaved={reloadOrders}
          />

          <TodayBoard orders={orders} meId={me} dateLabel={thaiDate(date)} />
        </div>
      )}
    </main>
  );
}
