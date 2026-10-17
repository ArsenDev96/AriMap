import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The server's Supabase client, with the secret key: it alone may call the player functions
 * (supabase/migrations). Server only: the secret key is never prefixed NEXT_PUBLIC_, and this module fails
 * the build if a client component imports it.
 *
 * Null when the backend is not configured (no URL or secret key): the player routes then answer
 * "notConfigured", and nothing stands in for the database.
 */
let client: SupabaseClient | null | undefined;

export function adminClient(): SupabaseClient | null {
  if (client === undefined) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    client = url && secretKey ? createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) : null;
  }
  return client;
}
