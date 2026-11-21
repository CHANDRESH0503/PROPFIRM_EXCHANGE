import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/public-env";
import type { Database } from "./database.types";

/**
 * Supabase client bound to the request's auth cookies. Acts as the signed-in user, so RLS applies.
 * Create one per request; never share across requests.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy refreshes
          // the session on the next request, so this is safe to ignore.
        }
      },
    },
  });
}
