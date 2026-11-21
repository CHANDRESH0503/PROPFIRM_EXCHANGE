"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/public-env";
import type { Database } from "./database.types";

/** Browser client. Holds only the anon key and the user's session; RLS governs everything it can do. */
export function createClient() {
  return createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
