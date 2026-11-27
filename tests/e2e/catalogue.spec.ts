import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("directory filters, shareable comparison and regional availability", async ({
  page,
}, info) => {
  await page.setExtraHTTPHeaders({ "cf-ipcountry": "GB" });
  await page.goto("/firms");
  await expect(page.getByRole("heading", { name: "Firm directory" })).toBeVisible();
  const paper = page.getByRole("link", { name: "Paper Kite (sample)" });
  await expect(paper).toBeVisible();
  await page.screenshot({ path: info.outputPath("directory.png"), fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
  ).toEqual([]);
  await page.getByRole("checkbox", { name: /Select Paper Kite/ }).check();
  await page.getByRole("checkbox", { name: /Select Chalk Orbit/ }).check();
  await page.getByRole("button", { name: "Compare programs" }).click();
  await expect(page.getByRole("columnheader", { name: /Paper Kite/ })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Chalk Orbit/ })).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "Chalk Orbit (sample)" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chalk Orbit (sample)");
  await page.getByText("Recent list prices", { exact: true }).first().click();
  await expect(page.locator("details[open] time").first()).toBeVisible();
  await page.setExtraHTTPHeaders({ "cf-ipcountry": "IN" });
  await page.goto("/firms?asset=forex");
  await expect(page.getByText("No matching programs")).toBeVisible();
  await page.goto("/deals");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Live deals");
});
