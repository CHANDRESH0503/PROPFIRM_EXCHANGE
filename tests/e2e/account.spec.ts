import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { deleteUser, e2eEmail, grantOwner, signIn } from "./support/auth";

/** Phase 0 done criteria: sign up → onboarding → empty Today; staff reach the admin shell. */
test.describe("account", () => {
  const created: string[] = [];
  test.afterAll(async () => {
    for (const id of created) await deleteUser(id);
  });

  test("new user onboards with country, timezone and 18+, then sees an empty Today", async ({ page }) => {
    const email = e2eEmail("onboard");
    created.push(await signIn(page, email, "/today"));

    await expect(page).toHaveURL(/\/onboarding\?next=%2Ftoday/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Before you start");

    // Submitting without the 18+ confirmation is refused beside the field.
    await page.getByLabel("Country of residence").selectOption("GB");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("You must be 18 or older to use this site.")).toBeVisible();

    await page.getByLabel(/I'm 18 or older/).check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByText("Daily check-in")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Opens at launch" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Level progress" })).toHaveAttribute("aria-valuenow", "0");

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);

    await page.goto("/profile");
    await expect(page.getByText("United Kingdom")).toBeVisible();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/today");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("non-staff get 403 on admin; an owner is sent to set up two-factor first", async ({ page }) => {
    const email = e2eEmail("admin");
    const id = await signIn(page, email, "/admin");
    created.push(id);
    await page.getByLabel("Country of residence").selectOption("GB");
    await page.getByLabel(/I'm 18 or older/).check();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "No access" })).toBeVisible();

    await grantOwner(email);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/mfa$/);
    await expect(page.getByRole("heading", { name: "Two-factor authentication" })).toBeVisible();
    await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
  });
});
