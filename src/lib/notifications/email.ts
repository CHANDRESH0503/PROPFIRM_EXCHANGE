import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Fixed template id, logged instead of any content. */
  template: string;
  /** Resend idempotency key: a retried send with the same key is delivered once. */
  idempotencyKey?: string;
}

export type SendResult = { ok: true } | { ok: false; reason: "not_configured" | "provider_error" };

let resend: Resend | undefined;

/**
 * Sends one transactional email. Without a Resend key outside production, the message is
 * printed to the dev console instead, so flows can be tried locally. Production refuses to
 * boot without a key (lib/env.ts).
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const { RESEND_API_KEY, EMAIL_FROM, APP_ENV } = env();

  if (!RESEND_API_KEY || !EMAIL_FROM) {
    if (APP_ENV === "local") {
      // Development only: the link inside is how you complete the flow without an email provider.
      console.info(`\n[dev email] ${message.template} → ${message.to}\n${message.text}\n`);
      await writeDevMail(message);
      return { ok: true };
    }
    log("error", "email.not_configured", { template: message.template });
    return { ok: false, reason: "not_configured" };
  }

  resend ??= new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send(
    { from: EMAIL_FROM, to: message.to, subject: message.subject, html: message.html, text: message.text },
    message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : undefined,
  );
  if (error) {
    log("error", "email.provider_error", { template: message.template, name: error.name });
    return { ok: false, reason: "provider_error" };
  }
  log("info", "email.sent", { template: message.template });
  return { ok: true };
}

/** Local mail sink for end-to-end tests: one JSON file per message in DEV_MAIL_DIR. */
async function writeDevMail(message: EmailMessage) {
  const dir = process.env.DEV_MAIL_DIR;
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${Date.now()}-${message.template}.json`);
  await writeFile(file, JSON.stringify({ to: message.to, subject: message.subject, text: message.text }, null, 2));
}
