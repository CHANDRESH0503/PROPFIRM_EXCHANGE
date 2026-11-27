import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// A first visit with no recorded choice.
test.use({ storageState: { cookies: [], origins: [] } });

test("cookie banner: essential only, change of mind from the footer, and accept", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Cookie choice" });
  await expect(banner).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(
    results.violations.flatMap((v) =>
      v.nodes.map((n) => `${v.id}: ${n.target.join(" ")} ${n.failureSummary ?? ""}`),
    ),
  ).toEqual([]);

  await banner.getByRole("button", { name: "Essential only" }).click();
  await expect(banner).toHaveCount(0);
  const denied = (await context.cookies()).find((c) => c.name === "analytics_consent");
  expect(denied?.value).toBe("denied");
  expect(denied?.sameSite).toBe("Lax");

  // The choice is remembered across pages.
  await page.goto("/tools");
  await expect(page.getByRole("region", { name: "Cookie choice" })).toHaveCount(0);

  // Reopen from the footer and accept.
  await page.getByRole("button", { name: "Cookie settings" }).click();
  await page
    .getByRole("region", { name: "Cookie choice" })
    .getByRole("button", { name: "Accept analytics" })
    .click();
  await expect(page.getByRole("region", { name: "Cookie choice" })).toHaveCount(0);
  expect((await context.cookies()).find((c) => c.name === "analytics_consent")?.value).toBe(
    "granted",
  );
});
