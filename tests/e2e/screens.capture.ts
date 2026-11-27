// Manual visual capture of signed-in screens (not part of the suite: no .spec suffix).
// Run against a running server: pnpm exec playwright test -c playwright.capture.config.ts
import { test } from "@playwright/test";
import { deleteUser, e2eEmail, signIn } from "./support/auth";

const OUT = process.env.CAPTURE_DIR ?? ".impeccable/review";

test("capture", async ({ page }, info) => {
  test.setTimeout(240_000);
  const tag = info.project.name;
  const id = await signIn(page, e2eEmail("shots"), "/today");
  try {
    await page.getByRole("heading", { name: "Before you start" }).waitFor();
    await page.screenshot({ path: `${OUT}/onboarding-${tag}.png`, fullPage: true });
    await page.getByLabel("Country of residence").selectOption("GB");
    await page.getByLabel(/I'm 18 or older/).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/today$/);
    await page.getByText("Daily check-in").waitFor();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/today-${tag}.png`, fullPage: true });
    for (const path of [
      "/rewards",
      "/accounts",
      "/profile",
      "/wallet",
      "/deals",
      "/firms",
      "/tools",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: `${OUT}${path}-${tag}.png`, fullPage: true });
    }
  } finally {
    await deleteUser(id);
  }
});
