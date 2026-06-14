import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Server-only Supabase client using the service-role key. This bypasses RLS,
 * so it must ONLY be used inside API route handlers that have already verified
 * the admin PIN. Never import this into a client component.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin is not configured (missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

/** Validate an admin PIN sent from the client against the server env. */
export function checkAdminPin(pin: string | null | undefined): boolean {
  const expected = process.env.ADMIN_PIN;
  if (!expected) return false;
  return typeof pin === "string" && pin.length > 0 && pin === expected;
}
