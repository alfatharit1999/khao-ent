import { NextRequest } from "next/server";
import { guardAdmin, ok, fail } from "@/lib/adminRoute";

const TYPES = ["topup", "front_credit", "adjustment", "settlement"];

/** Insert (or delete) a credit-ledger row: top-up, adjustment, or settlement. */
export async function POST(req: NextRequest) {
  const guard = guardAdmin(req);
  if ("error" in guard) return guard.error;
  const { supabase } = guard;

  const body = await req.json().catch(() => null);
  if (!body) return fail("ข้อมูลไม่ถูกต้อง");

  if (body.action === "delete") {
    if (!body.id) return fail("ไม่พบรายการ");
    const { error } = await supabase.from("credits").delete().eq("id", body.id);
    if (error) return fail(error.message, 500);
    return ok();
  }

  const person_id = body.person_id as string | undefined;
  const type = body.type as string | undefined;
  const amount = Number(body.amount);
  if (!person_id || !type || !TYPES.includes(type)) return fail("ข้อมูลไม่ครบ");
  if (!Number.isFinite(amount) || amount === 0)
    return fail("จำนวนเงินไม่ถูกต้อง");

  const { error } = await supabase.from("credits").insert({
    person_id,
    type,
    amount,
    date: body.date ?? new Date().toISOString().slice(0, 10),
    note: body.note ?? null,
  });
  if (error) return fail(error.message, 500);
  return ok();
}
