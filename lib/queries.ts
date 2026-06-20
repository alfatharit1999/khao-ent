import { getSupabase } from "./supabase";
import type { Balance, Order, Person, FundEntry, Setting } from "./types";

export type OrderWithPerson = Order & {
  people: { name: string; category: Person["category"]; sort_order: number } | null;
};

function db() {
  const s = getSupabase();
  if (!s) throw new Error("not-configured");
  return s;
}

export async function getPeople(): Promise<Person[]> {
  const { data, error } = await db()
    .from("people")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return data as Person[];
}

/**
 * Public: add a new person (visiting professor/fellow, etc.) without a PIN.
 * Returns the created person's id so the caller can auto-select them.
 */
export async function createPerson(
  name: string,
  category: Person["category"],
): Promise<string> {
  const { data, error } = await db()
    .from("people")
    .insert({ name: name.trim(), category, sort_order: 500 })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** All people incl. inactive — for the admin management list. */
export async function getAllPeople(): Promise<Person[]> {
  const { data, error } = await db()
    .from("people")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data as Person[];
}

export async function getOrdersForDate(date: string): Promise<OrderWithPerson[]> {
  const { data, error } = await db()
    .from("orders")
    .select("*, people(name, category, sort_order)")
    .eq("order_date", date);
  if (error) throw error;
  return (data as OrderWithPerson[]).sort(
    (a, b) => (a.people?.sort_order ?? 0) - (b.people?.sort_order ?? 0),
  );
}

export async function getBalances(): Promise<Balance[]> {
  const { data, error } = await db()
    .from("balances")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data as Balance[];
}

export async function upsertMyOrder(input: {
  person_id: string;
  order_date: string;
  location: "OR" | "OPD" | "BOTH" | null;
  menu_item: string | null;
  price: number;
}): Promise<void> {
  const { error } = await db()
    .from("orders")
    .upsert(input, { onConflict: "person_id,order_date" });
  if (error) throw error;
}

export async function deleteMyOrder(
  person_id: string,
  order_date: string,
): Promise<void> {
  const { error } = await db()
    .from("orders")
    .delete()
    .eq("person_id", person_id)
    .eq("order_date", order_date);
  if (error) throw error;
}

export async function getSpendBetween(
  start: string,
  end: string,
): Promise<Record<string, number>> {
  const { data, error } = await db()
    .from("orders")
    .select("person_id, price")
    .gte("order_date", start)
    .lte("order_date", end);
  if (error) throw error;
  const out: Record<string, number> = {};
  (data as { person_id: string; price: number }[]).forEach((r) => {
    out[r.person_id] = (out[r.person_id] ?? 0) + Number(r.price);
  });
  return out;
}

/**
 * Roll-over: person fronted cash at the treatment room for `date`.
 * Public action (no admin PIN) — RLS allows inserting front_credit only.
 * Credits them the amount laid out and flags that day's orders as fronted.
 */
export async function addFrontCredit(
  person_id: string,
  amount: number,
  date: string,
): Promise<void> {
  const s = db();
  const { error: cErr } = await s.from("credits").insert({
    person_id,
    date,
    type: "front_credit",
    amount,
    note: `สำรองจ่ายค่าข้าว ${date}`,
  });
  if (cErr) throw cErr;
  const { error: oErr } = await s
    .from("orders")
    .update({ fronted: true })
    .eq("order_date", date);
  if (oErr) throw oErr;
}

// ---- Professor daily meal + day seal (managed by the order person) --------

export async function getDayState(date: string): Promise<import("./types").DayState> {
  const { data, error } = await db()
    .from("day_state")
    .select("*")
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { date, sealed: false, prof_status: null };
  return {
    date,
    sealed: Boolean(data.sealed),
    prof_status: data.prof_status ?? null,
  };
}

/** Set the professor's meal for a day. `location` 'BOTH' = two boxes (×2 charge). */
export async function setProfessorMeal(input: {
  professor_id: string;
  date: string;
  location: "OR" | "OPD" | "BOTH";
  menu_item: string;
  unit_price: number;
}): Promise<void> {
  const total = input.unit_price * (input.location === "BOTH" ? 2 : 1);
  const { error: oErr } = await db()
    .from("orders")
    .upsert(
      {
        person_id: input.professor_id,
        order_date: input.date,
        location: input.location,
        menu_item: input.menu_item,
        price: total,
      },
      { onConflict: "person_id,order_date" },
    );
  if (oErr) throw oErr;
  const { error: sErr } = await db()
    .from("day_state")
    .upsert(
      { date: input.date, prof_status: "ordering", updated_at: new Date().toISOString() },
      { onConflict: "date" },
    );
  if (sErr) throw sErr;
}

/** Mark the professor as not ordering today (removes any meal row). */
export async function skipProfessor(
  professor_id: string,
  date: string,
): Promise<void> {
  const { error: dErr } = await db()
    .from("orders")
    .delete()
    .eq("person_id", professor_id)
    .eq("order_date", date);
  if (dErr) throw dErr;
  const { error: sErr } = await db()
    .from("day_state")
    .upsert(
      { date, prof_status: "skip", updated_at: new Date().toISOString() },
      { onConflict: "date" },
    );
  if (sErr) throw sErr;
}

/** Seal / unseal a day (gate for copying the order to the restaurant). */
export async function setSeal(date: string, sealed: boolean): Promise<void> {
  const { error } = await db()
    .from("day_state")
    .upsert(
      { date, sealed, updated_at: new Date().toISOString() },
      { onConflict: "date" },
    );
  if (error) throw error;
}

export async function getFundEntries(): Promise<FundEntry[]> {
  const { data, error } = await db()
    .from("fund_entries")
    .select("*")
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as FundEntry[];
}

export async function getSettings(): Promise<Record<string, string>> {
  const { data, error } = await db().from("settings").select("*");
  if (error) throw error;
  const out: Record<string, string> = {};
  (data as Setting[]).forEach((s) => (out[s.key] = s.value));
  return out;
}
