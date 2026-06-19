import { NextRequest } from "next/server";
import { guardAdmin, ok, fail } from "@/lib/adminRoute";

const CATEGORIES = ["R1", "R2", "R3", "F1", "F2", "F3", "professor"];

/** Create / update / toggle a person. */
export async function POST(req: NextRequest) {
  const guard = guardAdmin(req);
  if ("error" in guard) return guard.error;
  const { supabase } = guard;

  const body = await req.json().catch(() => null);
  if (!body) return fail("ข้อมูลไม่ถูกต้อง");
  const action = body.action as string;

  if (action === "create") {
    if (!body.name?.trim()) return fail("ใส่ชื่อก่อน");
    if (!CATEGORIES.includes(body.category)) return fail("ประเภทไม่ถูกต้อง");
    const { error } = await supabase.from("people").insert({
      name: body.name.trim(),
      category: body.category,
      sort_order: Number(body.sort_order) || 500,
      note: body.note ?? null,
    });
    if (error) return fail(error.message, 500);
    return ok();
  }

  if (action === "update") {
    if (!body.id) return fail("ไม่พบสมาชิก");
    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string") patch.name = body.name.trim();
    if (CATEGORIES.includes(body.category)) patch.category = body.category;
    if (body.sort_order != null) patch.sort_order = Number(body.sort_order);
    if (typeof body.active === "boolean") patch.active = body.active;
    if ("note" in body) patch.note = body.note ?? null;
    const { error } = await supabase
      .from("people")
      .update(patch)
      .eq("id", body.id);
    if (error) return fail(error.message, 500);
    return ok();
  }

  return fail("action ไม่ถูกต้อง");
}
