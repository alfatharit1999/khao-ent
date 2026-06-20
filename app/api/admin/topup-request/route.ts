import { NextRequest } from "next/server";
import { guardAdmin, ok, fail } from "@/lib/adminRoute";

export async function POST(req: NextRequest) {
  const guard = guardAdmin(req);
  if ("error" in guard) return guard.error;
  const { supabase } = guard;

  const body = await req.json().catch(() => null);
  if (!body) return fail("ข้อมูลไม่ถูกต้อง");
  const { action, id } = body;

  // Credit is already added at the time the user submits.
  // "check" just marks the log entry as verified against the bank transfer.
  if (action === "check") {
    const { error } = await supabase
      .from("topup_requests")
      .update({ status: "approved", resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return fail(error.message, 500);
    return ok();
  }

  // Delete a log entry (e.g. duplicate or test entry).
  if (action === "delete") {
    const { error } = await supabase
      .from("topup_requests")
      .delete()
      .eq("id", id);
    if (error) return fail(error.message, 500);
    return ok();
  }

  return fail("action ไม่ถูกต้อง");
}
