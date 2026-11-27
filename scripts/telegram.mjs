#!/usr/bin/env node
// Telegram bot tasks.
//
//   pnpm telegram webhook      register https://<site>/api/telegram with the secret (needs HTTPS)
//   pnpm telegram info         show webhook status (no secrets printed)
//   pnpm telegram poll         local development: long-poll Telegram and forward updates to the
//                              local /api/telegram route (removes any webhook while running)
//   pnpm telegram test-alert   send a test message to OWNER_TELEGRAM_CHAT_ID
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const {
  TELEGRAM_BOT_TOKEN: token,
  TELEGRAM_WEBHOOK_SECRET: secret,
  OWNER_TELEGRAM_CHAT_ID: owner,
} = process.env;
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
if (!token) {
  console.error("telegram: TELEGRAM_BOT_TOKEN is not set");
  process.exit(1);
}

async function api(method, body = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method}: ${json.description}`);
  return json.result;
}

const commands = [
  { command: "coins", description: "Coin balance and pending Coins" },
  { command: "streak", description: "Check-in and journal streaks" },
  { command: "today", description: "Today's high-impact events" },
  { command: "next", description: "The next high-impact event" },
  { command: "help", description: "What this bot can do" },
  { command: "stop", description: "Disconnect this chat" },
];

const [task] = process.argv.slice(2);
if (task === "webhook") {
  if (!secret) throw new Error("TELEGRAM_WEBHOOK_SECRET is not set");
  if (!site.startsWith("https://"))
    throw new Error(
      `Telegram needs an HTTPS URL; NEXT_PUBLIC_SITE_URL is ${site}. Use "poll" locally.`,
    );
  await api("setWebhook", {
    url: `${site}/api/telegram`,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
  await api("setMyCommands", { commands });
  console.log(`telegram: webhook set to ${site}/api/telegram`);
} else if (task === "info") {
  const info = await api("getWebhookInfo");
  console.log({
    url: info.url || "(none)",
    pending: info.pending_update_count,
    lastError: info.last_error_message ?? null,
  });
} else if (task === "test-alert") {
  if (!owner) throw new Error("OWNER_TELEGRAM_CHAT_ID is not set");
  await api("sendMessage", {
    chat_id: owner,
    text: "Fundback: owner alerts are connected. Job failures will be reported here.",
  });
  console.log("telegram: test alert sent");
} else if (task === "poll") {
  if (!secret) throw new Error("TELEGRAM_WEBHOOK_SECRET is not set");
  await api("deleteWebhook", {});
  await api("setMyCommands", { commands });
  console.log(`telegram: polling; forwarding to ${site}/api/telegram (Ctrl+C to stop)`);
  let offset = 0;
  for (;;) {
    const updates = await api("getUpdates", {
      offset,
      timeout: 30,
      allowed_updates: ["message"],
    }).catch((e) => {
      console.error(e.message);
      return [];
    });
    for (const update of updates) {
      offset = update.update_id + 1;
      const res = await fetch(`${site}/api/telegram`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
        body: JSON.stringify(update),
      });
      // The webhook answers with a method call in its body; in polling mode we make that call.
      const reply = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
      if (reply?.method) {
        const { method, ...body } = reply;
        await api(method, body).catch((e) => console.error(e.message));
      }
    }
  }
} else {
  console.error("usage: pnpm telegram <webhook|info|poll|test-alert>");
  process.exit(1);
}
