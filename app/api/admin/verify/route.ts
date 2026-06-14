import { NextRequest } from "next/server";
import { guardAdmin, ok } from "@/lib/adminRoute";

export async function POST(req: NextRequest) {
  const guard = guardAdmin(req);
  if ("error" in guard) return guard.error;
  return ok();
}
