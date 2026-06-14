import { getSupabase } from "./supabase";
import type { Balance, Order, Person, FundEntry, Setting } from "./types";

export type OrderWithPerson = Order & {
  people: { name: string; kind: Person["kind"]; sort_order: number } | null;
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
    .select("*, people(name, kind, sort_order)")
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
  location: "OR" | "OPD" | null;
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
