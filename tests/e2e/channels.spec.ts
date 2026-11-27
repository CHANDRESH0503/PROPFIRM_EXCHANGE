import { expect, test, type Page } from "@playwright/test";
import { deleteUser, e2eEmail, signIn } from "./support/auth";

async function onboard(page: Page, next: string) {
  const id = await signIn(page, e2eEmail("channels"), next);
  await page.getByLabel("Country of residence").selectOption("GB");
  await page.getByLabel(/I'm 18 or older/).check();
  await page.getByRole("button", { name: "Continue" }).click();
  return id;
}

test.describe("notification channels", () => {
  test.skip(
    !process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_WEBHOOK_SECRET,
    "Telegram not configured",
  );
  const created: string[] = [];
  test.afterAll(async () => {
    for (const id of created) await deleteUser(id);
  });

  test("connect Telegram with a one-time link, use commands, disconnect", async ({
    page,
    request,
  }, info) => {
    created.push(await onboard(page, "/notifications"));
    await expect(page.getByRole("heading", { name: "Telegram and phone alerts" })).toBeVisible();

    // Webhook refuses calls without the registered secret.
    expect((await request.post("/api/telegram", { data: {} })).status()).toBe(401);

    await page.getByRole("button", { name: "Connect Telegram" }).click();
    const link = page.getByRole("link", { name: "Open Telegram app" });
    await expect(link).toHaveAttribute(
      "href",
      /^https:\/\/t\.me\/[A-Za-z0-9_]+\?start=[A-Za-z0-9_-]{16,64}$/,
    );
    const code = new URL((await link.getAttribute("href"))!).searchParams.get("start")!;
    // Computers without the Telegram app (Safari cannot open tg:// links) get Telegram Web,
    // a QR code for a phone, and the command to send by hand.
    await expect(page.getByRole("link", { name: "Use Telegram Web" })).toHaveAttribute(
      "href",
      `https://web.telegram.org/k/#?tgaddr=${encodeURIComponent(`tg://resolve?domain=FundBack_Bot&start=${code}`)}`,
    );
    await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
    await expect(page.getByText(`/start ${code}`, { exact: true })).toBeVisible();

    // Without a webhook the page pulls bot updates itself while it waits; Telegram's queue drains.
    await expect(page.getByText("Waiting for you to press Start in Telegram…")).toBeVisible();
    const bot = async (method: string) =>
      (await (
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`)
      ).json()) as {
        result: { url: string; pending_update_count: number };
      };
    if (!(await bot("getWebhookInfo")).result.url) {
      await expect
        .poll(async () => (await bot("getWebhookInfo")).result.pending_update_count, {
          timeout: 20_000,
        })
        .toBe(0);
    }

    // A fake private chat id: replies come back in the webhook response, nothing is sent.
    const chat =
      900_000_000 +
      Math.floor(Math.random() * 99_999_999) +
      (info.project.name === "phone" ? 0 : 1);
    const say = async (text: string) => {
      const res = await request.post("/api/telegram", {
        headers: { "x-telegram-bot-api-secret-token": process.env.TELEGRAM_WEBHOOK_SECRET! },
        data: {
          update_id: Date.now(),
          message: { chat: { id: chat, type: "private" }, from: { username: "e2e_trader" }, text },
        },
      });
      expect(res.status()).toBe(200);
      return (await res.json()) as { method: string; chat_id: number; text: string };
    };

    expect((await say("/coins")).text).toContain("connect your Fundback account");
    // Pasting the code alone works like "/start <code>".
    expect((await say(code)).text).toContain("Connected to Fundback");
    // The code works once.
    expect((await say(`/start ${code}`)).text).toContain("expired");
    await page.reload();
    await expect(page.getByText("Connected to Telegram as @e2e_trader.")).toBeVisible();

    const coins = await say("/coins");
    expect(coins).toMatchObject({ method: "sendMessage", chat_id: chat });
    expect(coins.text).toContain("Available: 0 Coins");
    expect((await say("/streak")).text).toContain("Check-in streak");
    expect((await say("/next")).text).toMatch(/Next high-impact event|No high-impact events/);

    await page.getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByRole("button", { name: "Connect Telegram" })).toBeVisible();
    expect((await say("/coins")).text).toContain("connect your Fundback account");

    // Device notifications resolve to the browser's real state (headless Chromium always reports
    // "denied"), never stay on "Checking".
    await expect(
      page
        .getByRole("button", { name: "Turn on device notifications" })
        .or(page.getByText("This browser doesn't support notifications from websites."))
        .or(page.getByText("Notifications are blocked for this site in your browser settings.")),
    ).toBeVisible();
    await expect(page.getByText("Checking this device…")).toHaveCount(0);
  });
});
