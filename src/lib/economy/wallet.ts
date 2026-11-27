import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
export const walletBalance = cache(async (userId: string) => {
  const { data, error } = await (
    await createClient()
  )
    .from("wallet_balances")
    .select("available,pending")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("wallet_unavailable");
  return { available: Number(data?.available ?? 0), pending: Number(data?.pending ?? 0) };
});
