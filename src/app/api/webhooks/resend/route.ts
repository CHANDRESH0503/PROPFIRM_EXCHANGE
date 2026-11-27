import { Resend } from "resend";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { RESEND_WEBHOOK_SECRET, RESEND_API_KEY } = env();
  if (!RESEND_WEBHOOK_SECRET || !RESEND_API_KEY) return new Response(null, { status: 503 });
  let event;
  try {
    event = new Resend(RESEND_API_KEY).webhooks.verify({
      payload: await request.text(),
      webhookSecret: RESEND_WEBHOOK_SECRET,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
    });
  } catch {
    return new Response(null, { status: 401 });
  }
  if (event.type === "email.complained" || event.type === "email.bounced") {
    for (const email of event.data.to) {
      const { error } = await createAdminClient().rpc("suppress_email", { p_email: email });
      if (error) return new Response(null, { status: 503 });
    }
  }
  return new Response(null, { status: 204 });
}
