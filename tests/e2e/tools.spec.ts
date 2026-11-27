import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(
    results.violations.flatMap((v) =>
      v.nodes.map((n) => `${v.id}: ${n.target.join(" ")} ${n.failureSummary ?? ""}`),
    ),
  ).toEqual([]);
}

test("lot size: live result, conversion price only when needed, shareable link", async ({
  page,
}, info) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Tools" })
    .click();
  await expect(page.getByRole("heading", { name: "Trader tools", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: /Prop lot size calculator/ }).click();
  await expect(
    page.getByRole("heading", { name: "Prop lot size calculator", level: 1 }),
  ).toBeVisible();

  await page.getByLabel("Account balance").fill("100000");
  await page.getByLabel("Risk per trade").fill("1");
  await page.getByLabel("Stop loss distance").fill("20");
  const result = page.getByRole("region", { name: "Result" });
  await expect(result.getByText("5.00", { exact: true })).toBeVisible();
  await expect(result.getByText("$1,000.00").first()).toBeVisible();

  // A JPY cross in a USD account needs the USDJPY price; the field appears only then.
  // 1,000 JPY per pip per lot at 150 is $6.67; a $1,000 risk over 20 pips is 7.50 lots.
  await expect(page.getByLabel("USDJPY price")).toHaveCount(0);
  await page.getByLabel("Instrument").selectOption("EURJPY");
  // With a price feed configured the empty field falls back to an indicative price; without one
  // it is required. Either way a typed price overrides it.
  const usdjpy = page.getByLabel("USDJPY price");
  await expect(usdjpy).toBeVisible();
  // The feed can be rate-limited by the provider, so accept either state; a typed price must
  // override in both.
  await expect(
    page
      .getByText(/Using the indicative price/)
      .or(page.getByText("Needed to convert JPY into USD.")),
  ).toBeVisible();
  await page.getByLabel("USDJPY price").fill("150");
  await expect(result.getByText("7.50", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Calculate" }).click();
  await expect(page).toHaveURL(/symbol=EURJPY/);
  await expect(page).toHaveURL(/rate=150/);
  await page.screenshot({ path: info.outputPath("lot-size.png"), fullPage: true });
  await axe(page);

  // The URL alone reproduces the result (server-rendered, no typing).
  await page.reload();
  await expect(result.getByText("7.50", { exact: true })).toBeVisible();
});

test("daily room: trailing drawdown, close-call warning and max lots", async ({ page }, info) => {
  await page.goto("/tools/daily-room");
  await page.getByLabel("Starting account size").fill("100000");
  await page.getByLabel("Daily loss limit (%)").fill("5");
  await page.getByLabel("Max loss limit (%)").fill("10");
  await page.getByLabel("Max loss type").selectOption("trailing");
  await page.getByLabel("Balance or equity at today's reset").fill("104000");
  await page.getByLabel("Highest point reached").fill("104000");
  await page.getByLabel("Current balance").fill("99800");
  const result = page.getByRole("region", { name: "Result" });
  await expect(result.getByText("You are within 20% of the daily limit.")).toBeVisible();
  await expect(result.getByText("$800.00").first()).toBeVisible();
  await page.getByLabel("Stop loss in pips (optional)").fill("20");
  await expect(result.getByText("Largest position for your stop")).toBeVisible();
  await expect(result.getByText("4.00", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("daily-room.png"), fullPage: true });
  await axe(page);
});

test("calendar labels fixture data and filters by impact", async ({ page }, info) => {
  await page.goto("/economic-calendar");
  await expect(page.getByRole("note")).toContainText("every event and figure below is fictional");
  await page.getByRole("button", { name: "This week" }).click();
  await page.getByRole("button", { name: "High only" }).click();
  await expect(page.getByRole("button", { name: "High only" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("Medium impact")).toHaveCount(0);
  await expect(page.getByText("High impact").first()).toBeVisible();
  await page.screenshot({ path: info.outputPath("calendar.png"), fullPage: true });
  await axe(page);
});

test("sessions clock renders the four sessions and the weekly close", async ({ page }, info) => {
  await page.goto("/tools/market-sessions");
  for (const name of ["Sydney", "Tokyo", "London", "New York"]) {
    await expect(page.getByRole("heading", { name, level: 3 })).toBeVisible();
  }
  await expect(page.getByText("Weekly close", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("sessions.png"), fullPage: true });
  await axe(page);
});
