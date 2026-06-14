import { NextRequest } from "next/server";
import { guardAdmin, ok, fail } from "@/lib/adminRoute";

/** Add a central-fund (กองกลาง) ledger row, or delete one (action: "delete"). */
export async function POST(req: NextRequest) {
  const guard = guardAdmin(req);
  if ("error" in guard) return guard.error;
  const { supabase } = guard;

  const body = await req.json().catch(() => null);
  if (!body) return fail("ข้อมูลไม่ถูกต้อง");

  if (body.action === "delete") {
    if (!body.id) return fail("ไม่พบรายการ");
    const { error } = await supabase
      .from("fund_entries")
      .delete()
      .eq("id", body.id);
    if (error) return fail(error.message, 500);
    return ok();
  }

  const income = Number(body.income) || 0;
  const expense = Number(body.expense) || 0;
  if (!body.date) return fail("ใส่วันที่ก่อน");
  if (income <= 0 && expense <= 0) return fail("ใส่จำนวนเงินรายรับหรือรายจ่าย");

  const { error } = await supabase.from("fund_entries").insert({
    date: body.date,
    description: body.description ?? null,
    income,
    expense,
    recipient: body.recipient ?? null,
    account: body.account ?? null,
    note: body.note ?? null,
  });
  if (error) return fail(error.message, 500);
  return ok();
}
