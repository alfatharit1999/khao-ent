import { NextRequest } from "next/server";
import { guardAdmin, ok, fail } from "@/lib/adminRoute";

export async function POST(req: NextRequest) {
  const guard = guardAdmin(req);
  if ("error" in guard) return guard.error;
  const { supabase } = guard;

  const body = await req.json().catch(() => null);
  if (!body) return fail("ข้อมูลไม่ถูกต้อง");
  const { action, id, amount } = body;

  if (action === "approve") {
    const { data: row, error: rErr } = await supabase
      .from("topup_requests")
      .select("person_id, amount")
      .eq("id", id)
      .single();
    if (rErr || !row) return fail("ไม่พบคำขอ");

    const finalAmount =
      amount != null && Number(amount) > 0 ? Number(amount) : Number(row.amount);

    const { error: cErr } = await supabase.from("credits").insert({
      person_id: row.person_id,
      type: "topup",
      amount: finalAmount,
      note: `เติมเครดิต (อนุมัติจากคำขอ)`,
    });
    if (cErr) return fail(cErr.message, 500);

    const { error: uErr } = await supabase
      .from("topup_requests")
      .update({ status: "approved", resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (uErr) return fail(uErr.message, 500);
    return ok();
  }

  if (action === "reject") {
    const { error } = await supabase
      .from("topup_requests")
      .update({ status: "rejected", resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return fail(error.message, 500);
    return ok();
  }

  return fail("action ไม่ถูกต้อง");
}
