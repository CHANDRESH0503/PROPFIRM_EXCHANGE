import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/public-env";
import type { Database } from "./database.types";

/**
 * Cookie-free client acting as a visitor (anon role, RLS applies). For public pages, so they
 * don't read the session and can be cached.
 */
export function createAnonClient() {
  return createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
