// Manual visual capture of signed-in screens (not part of the suite: no .spec suffix).
// Run: pnpm exec playwright test --config=playwright.config.ts tests/e2e/screens.capture.ts
import { test } from "@playwright/test";
import { deleteUser, e2eEmail, signIn } from "./support/auth";

test("capture", async ({ page }) => {
  const id = await signIn(page, e2eEmail("shots"), "/today");
  await page.getByRole("heading", { name: "Before you start" }).waitFor();
  await page.screenshot({ path: ".impeccable/review/onboarding.png", fullPage: true });
  await page.getByLabel("Country of residence").selectOption("GB");
  await page.getByLabel(/I'm 18 or older/).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/today$/);
  await page.getByText("Daily check-in").waitFor();
  await page.waitForTimeout(900); // ring fill transition
  await page.screenshot({ path: ".impeccable/review/today.png", fullPage: true });
  await page.screenshot({ path: ".impeccable/review/today-viewport.png" });
  await page.goto("/profile");
  await page.getByText("United Kingdom").waitFor();
  await page.screenshot({ path: ".impeccable/review/profile.png", fullPage: true });
  await page.goto("/deals");
  await page.getByText("opens at launch").waitFor();
  await page.screenshot({ path: ".impeccable/review/deals.png", fullPage: true });
  await deleteUser(id);
});
