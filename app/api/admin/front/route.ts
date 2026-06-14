import { NextRequest } from "next/server";
import { guardAdmin, ok, fail } from "@/lib/adminRoute";

/**
 * Roll-over: person X fronted the cash at the treatment room for a given day.
 * Credits X by the amount they laid out and flags that day's orders as fronted.
 * X's own meal is still deducted via their order row, so X nets to just their meal.
 */
export async function POST(req: NextRequest) {
  const guard = guardAdmin(req);
  if ("error" in guard) return guard.error;
  const { supabase } = guard;

  const body = await req.json().catch(() => null);
  const person_id = body?.person_id as string | undefined;
  const amount = Number(body?.amount);
  const date = body?.date as string | undefined;
  const note = (body?.note as string | undefined) ?? null;

  if (!person_id || !date) return fail("ข้อมูลไม่ครบ");
  if (!Number.isFinite(amount) || amount <= 0) return fail("จำนวนเงินไม่ถูกต้อง");

  const { error: cErr } = await supabase.from("credits").insert({
    person_id,
    date,
    type: "front_credit",
    amount,
    note: note ?? `สำรองจ่ายค่าข้าว ${date}`,
  });
  if (cErr) return fail(cErr.message, 500);

  const { error: oErr } = await supabase
    .from("orders")
    .update({ fronted: true })
    .eq("order_date", date);
  if (oErr) return fail(oErr.message, 500);

  return ok();
}
