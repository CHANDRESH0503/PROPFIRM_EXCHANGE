import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Service-role client. Bypasses RLS: use only from server code that has already
 * authenticated and authorised the caller, and prefer calling a Postgres function
 * that re-checks its own invariants (docs/SYSTEM_DESIGN.md §3).
 */
let client: ReturnType<typeof createClient<Database>> | undefined;

export function createAdminClient() {
  if (client) return client;
  const e = env();
  client = createClient<Database>(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-client-info": "fundback-server" } },
  });
  return client;
}
