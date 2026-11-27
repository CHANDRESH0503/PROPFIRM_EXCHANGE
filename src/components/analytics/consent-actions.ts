"use server";

import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stores a signed-in member's analytics choice so staff- and job-side events respect it. The
 * browser cookie is set on the client; this is only the server copy.
 */
export async function recordConsent(granted: boolean) {
  const user = await getSessionUser();
  if (!user || typeof granted !== "boolean") return;
  if (!(await rateLimit("inboxWrite", user.id))) return;
  await createAdminClient().rpc("set_analytics_consent", { p_user: user.id, p_granted: granted });
}
