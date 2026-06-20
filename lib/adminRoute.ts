import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminPin, getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Verify the admin PIN on an incoming request.
 * Returns the service-role Supabase client, or a 401 response to return early.
 */
export function guardAdmin(req: NextRequest) {
  const pin = decodeURIComponent(req.headers.get("x-admin-pin") ?? "");
  if (!checkAdminPin(pin)) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { supabase: getSupabaseAdmin() };
}

export function ok(data: unknown = { ok: true }) {
  return NextResponse.json(data);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
