import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { linkFromLatestMail } from "./support/mail";

const unique = () => `e2e+${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
// Each run is a different visitor: the waitlist allows 10 joins per IP an hour, and outside
// Cloudflare the app reads the client address from X-Forwarded-For (TEST-NET-3 range).
const visitorIp = () => `203.0.113.${1 + Math.floor(Math.random() * 254)}`;

test.describe("waitlist", () => {
  test("home states the deal, the commission and the odds, and passes axe", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("90%");
    await expect(page.getByText(/most traders don't pass/i).first()).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText(/earns a commission/i);
    await expect(page.getByText("2,025").first()).toBeAttached();

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });

  test("join → confirm by email → see place and referral link", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-for": visitorIp() });
    const email = unique();
    await page.goto("/?utm_source=e2e");
    const form = page.getByRole("textbox", { name: "Email address" }).first();
    await form.fill(email);
    await page.getByRole("button", { name: "Reserve my place" }).first().click();
    await expect(page.getByText("Check your inbox").first()).toBeVisible();

    const link = await linkFromLatestMail(email);
    expect(link).toContain("/waitlist/open?token=");
    // Email links use NEXT_PUBLIC_SITE_URL; open the same path on the server under test.
    const { pathname, search } = new URL(link);
    await page.goto(pathname + search);
    await expect(page).toHaveURL(/\/waitlist\/me$/);
    await expect(page.getByText("You're confirmed.")).toBeVisible();
    const invite = page.getByRole("textbox", { name: "Your invite link" });
    await expect(invite).toHaveValue(/\?ref=[A-Z2-9]{8}$/);

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  test("rejects an invalid email beside the field", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-for": visitorIp() });
    await page.goto("/");
    const input = page.getByRole("textbox", { name: "Email address" }).first();
    await input.fill("not-an-email");
    // Native validation blocks submit; remove it to prove the server check too.
    await input.evaluate((el) => el.setAttribute("type", "text"));
    await page.getByRole("button", { name: "Reserve my place" }).first().click();
    await expect(page.getByText("Enter a valid email address").first()).toBeVisible();
    await expect(input).toHaveAttribute("aria-invalid", "true");
  });

  test("a bad link explains itself", async ({ page }) => {
    await page.goto("/waitlist/open?token=" + "x".repeat(43));
    await expect(page).toHaveURL(/link=invalid/);
    await expect(page.getByText(/expired or was replaced/).first()).toBeVisible();
  });
});

test.describe("guards", () => {
  test("app and admin routes send signed-out visitors to sign-in", async ({ page }) => {
    for (const path of ["/today", "/admin"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=${encodeURIComponent(path)}`));
    }
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });
});
