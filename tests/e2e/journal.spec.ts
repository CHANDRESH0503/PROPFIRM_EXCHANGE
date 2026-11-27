import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { adminClient, deleteUser, e2eEmail, signIn } from "./support/auth";

async function onboard(page: Page, next: string) {
  const id = await signIn(page, e2eEmail("journal"), next);
  await page.getByLabel("Country of residence").selectOption("GB");
  await page.getByLabel(/I'm 18 or older/).check();
  await page.getByRole("button", { name: "Continue" }).click();
  return id;
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const detail = results.violations.flatMap((v) =>
    v.nodes.slice(0, 3).map((n) => `${v.id} ${n.target.join(" ")} ${n.failureSummary ?? ""}`),
  );
  expect(detail).toEqual([]);
}

test.describe("navigation keeps members signed in", () => {
  const created: string[] = [];
  test.afterAll(async () => {
    for (const id of created) await deleteUser(id);
  });

  test("the logo and account link lead back into the app from public and nested screens", async ({
    page,
  }) => {
    // Mid-onboarding the logo keeps the member in the app (Today sends them back to onboarding).
    created.push(await signIn(page, e2eEmail("nav"), "/today"));
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByRole("link", { name: "Fundback", exact: true })).toHaveAttribute(
      "href",
      "/today",
    );
    await page.getByRole("link", { name: "Fundback", exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding/);
    await page.getByLabel("Country of residence").selectOption("GB");
    await page.getByLabel(/I'm 18 or older/).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/today$/);

    // A missing page offers the way back into the app, not the landing page.
    await page.goto("/no-such-page");
    await page.getByRole("link", { name: "Back to Today" }).click();
    await expect(page.getByText("Daily check-in")).toBeVisible();

    // Public page: the header recognises the session instead of offering "Sign in".
    await page.goto("/tools");
    await expect(page.getByRole("link", { name: "Open app" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
    await page.getByRole("link", { name: "Fundback", exact: true }).click();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByText("Daily check-in")).toBeVisible();

    // Nested app screens keep their tab highlighted and the logo returns to Today.
    for (const [path, tab] of [
      ["/wallet", "Rewards"],
      ["/notifications", "Profile"],
      ["/claims", "Deals"],
    ] as const) {
      await page.goto(path);
      await expect(
        page
          .getByRole("navigation", { name: "App" })
          .filter({ visible: true })
          .getByRole("link", { name: tab }),
      ).toHaveAttribute("aria-current", "page");
      await page.getByRole("link", { name: "Fundback", exact: true }).click();
      await expect(page).toHaveURL(/\/today$/);
      await expect(page.getByText("Daily check-in")).toBeVisible();
    }
  });
});

test.describe("journal", () => {
  test.beforeAll(async () => {
    // Needs migration 20261122000400_journal on the target project.
    const probe = await adminClient().from("journal_tags").select("id").limit(1);
    test.skip(Boolean(probe.error), "journal migration not applied to this Supabase project");
  });
  const created: string[] = [];
  test.afterAll(async () => {
    for (const id of created) await deleteUser(id);
  });

  test("quick log, full entry with tags and rules, dashboard, edit and delete", async ({
    page,
  }, info) => {
    created.push(await onboard(page, "/accounts"));
    await expect(page).toHaveURL(/\/accounts$/);
    await expect(page.getByText("Your journal is empty")).toBeVisible();
    await axe(page);

    // Quick log a loss with a mistake tag.
    await page.getByLabel("Symbol", { exact: true }).fill("eurusd");
    await page.getByLabel("Result", { exact: true }).fill("-40");
    await page.getByLabel("Tag (optional)").selectOption({ label: "Revenge trade" });
    await page.getByRole("button", { name: "Log trade" }).click();
    await expect(page.getByText("Trade logged.")).toBeVisible();
    await expect(page.getByText("Journaled today")).toBeVisible();
    await expect(page.getByText("1 day journal streak")).toBeVisible();

    // A strategy with rules.
    await page.getByRole("link", { name: "Strategies and tags" }).click();
    await page.getByLabel("Name", { exact: true }).fill("London breakout");
    await page
      .getByLabel("Rules, one per line")
      .fill("Wait for the 15-minute close\nRisk 1% or less");
    await page.getByRole("button", { name: "Save strategy" }).click();
    await expect(page.getByRole("heading", { name: "London breakout" })).toBeVisible();

    // Full entry: a winning long with prices, so pips and R are calculated.
    await page.goto("/accounts/trades/new");
    await page.getByLabel("Symbol", { exact: true }).fill("EURUSD");
    await page.getByLabel("Profit or loss", { exact: true }).fill("100");
    await page.getByLabel("Commission (optional)").fill("-7");
    await page.getByLabel("Entry price", { exact: true }).fill("1.10000");
    await page.getByLabel("Exit price", { exact: true }).fill("1.10200");
    await page.getByLabel("Stop loss", { exact: true }).fill("1.09900");
    await page.getByLabel("Strategy", { exact: true }).selectOption({ label: "London breakout" });
    await page.getByLabel("Wait for the 15-minute close").selectOption("followed");
    await page.getByLabel("Risk 1% or less").selectOption("broken");
    await page.getByLabel("Calm", { exact: true }).check();
    await page.getByRole("button", { name: "Save trade" }).click();
    await expect(page).toHaveURL(/\/accounts\/trades\/[0-9a-f-]+\?saved=1/);
    await expect(page.getByText("Trade saved.")).toBeVisible();
    await expect(page.getByText("+$93.00")).toBeVisible();
    await expect(page.getByText("20.0", { exact: true })).toBeVisible();
    await expect(page.getByText("2.00 R")).toBeVisible();
    await axe(page);

    // Dashboard figures across both trades: +93 and -40 net.
    await page.goto("/accounts");
    await expect(page.getByText("+$53.00").first()).toBeVisible();
    await expect(page.getByText("50%").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cost of mistakes" })).toBeVisible();
    await expect(page.getByText("-$40.00").first()).toBeVisible();
    await page.screenshot({ path: info.outputPath("journal.png"), fullPage: true });
    await axe(page);

    // Interactive charts: hover a bar for its details, move with the keyboard, open a day.
    const daily = page.getByRole("img", { name: /Net P&L per trading day/ });
    await daily.hover();
    await expect(page.getByText("Won / lost").first()).toBeVisible();
    await expect(page.getByText("1 / 1").first()).toBeVisible();
    const equity = page.getByRole("img", { name: /Cumulative net P&L/ });
    await equity.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("Running total", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("journal-hover.png") });
    const today = page.getByRole("link", { name: /\+\$53\.00, 2 trades/ });
    await today.hover();
    await expect(page.getByText("1 / 1 · 2 trades")).toBeVisible();
    await today.click();
    await expect(page.getByRole("heading", { name: /^Trades on / })).toBeVisible();
    await expect(page.getByRole("link", { name: /EURUSD/ })).toHaveCount(2);
    await page.goto("/accounts");

    // CSV export: the member's own trades only, with exact amounts and a download filename.
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/-journal-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = (await file.createReadStream()).toArray();
    const text = Buffer.concat(await csv).toString("utf8");
    const lines = text
      .replace(/^\uFEFF/, "")
      .trim()
      .split("\r\n");
    expect(lines[0]).toMatch(/^closed_at,opened_at,local_day,symbol,direction,/);
    expect(lines).toHaveLength(3);
    expect(lines.filter((l) => l.includes(",EURUSD,"))).toHaveLength(2);

    // Edit, then delete the full entry.
    await page.getByRole("link", { name: "All trades" }).click();
    await page.getByRole("link", { name: /EURUSD.*Long.*\+\$93\.00/ }).click();
    await page.getByLabel("Profit or loss", { exact: true }).fill("150");
    await page.getByRole("button", { name: "Save trade" }).click();
    await expect(page.getByText("+$143.00")).toBeVisible();
    await page.getByRole("button", { name: "Delete trade" }).click();
    await page.getByRole("button", { name: "Yes, delete" }).click();
    await expect(page).toHaveURL(/\/accounts\/trades$/);
    await expect(page.getByRole("link", { name: /\+\$143\.00/ })).toHaveCount(0);
  });
});

test.describe("journal landing", () => {
  test("the landing page sends visitors to sign in and members to their journal", async ({
    page,
  }) => {
    await page.goto("/journal?ref=journal-reel");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("trading journal");
    await expect(page.getByRole("link", { name: "Start your journal" })).toHaveAttribute(
      "href",
      /\/sign-in\?next=%2Faccounts%2Ftrades%2Fnew/,
    );
    await axe(page);
  });
});
