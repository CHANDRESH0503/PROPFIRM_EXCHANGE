import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { deleteUser, e2eEmail, signIn } from "./support/auth";

test("weekly journal review: answer, earn XP once, edit, and see the rule on Today", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const id = await signIn(page, e2eEmail("review"), "/accounts/review");
  try {
    await page.getByLabel("Country of residence").selectOption("GB");
    await page.getByLabel(/I'm 18 or older/).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/accounts\/review$/);

    await expect(page.getByRole("heading", { name: "Weekly review", level: 1 })).toBeVisible();
    await expect(page.getByText("+100 XP when you finish")).toBeVisible();
    await expect(page.getByText(/No trades logged this week/)).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(
      results.violations.flatMap((v) =>
        v.nodes.map((n) => `${v.id}: ${n.target.join(" ")} ${n.failureSummary ?? ""}`),
      ),
    ).toEqual([]);

    await page.getByLabel("What worked?").fill("Waited for the London retest.");
    await page.getByLabel("What didn't?").fill("Traded the first minutes after the open.");
    await page.getByLabel("Which mistake cost the most?").fill("Moved my stop loss.");
    await page.getByRole("radio", { name: "Partly" }).check();
    await page.getByRole("radio", { name: "4" }).check({ force: true });
    await page.getByLabel("One rule to follow next week").fill("No trades in the first 15 minutes");
    await page.getByRole("button", { name: "Finish review" }).click();
    await expect(page.getByRole("status").filter({ hasText: "+100 XP" })).toBeVisible();

    // Editing the same week updates the answers and earns nothing more.
    await page.reload();
    await expect(page.getByLabel("One rule to follow next week")).toHaveValue(
      "No trades in the first 15 minutes",
    );
    await page.getByLabel("One rule to follow next week").fill("No trades before 08:15");
    await page.getByRole("button", { name: "Update review" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Review updated." })).toBeVisible();

    // The rule appears on Today, and the XP appears once in recent activity.
    await page.goto("/today");
    await expect(page.getByRole("heading", { name: "This week's rule" })).toBeVisible();
    await expect(page.getByText("No trades before 08:15")).toBeVisible();
    await expect(page.getByText("Weekly journal review")).toHaveCount(1);

    // The reminder can be switched off with the other notification preferences.
    await page.goto("/notifications");
    const reminder = page.getByLabel("Weekly journal review reminder");
    await expect(reminder).toBeChecked();
    await reminder.uncheck();
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByText("Preferences saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Weekly journal review reminder")).not.toBeChecked();

    // Quiet hours and the daily cap for messages outside the app.
    await page.getByLabel("From").selectOption("22");
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(
      page.getByText("Choose both a start and an end time, and make them different."),
    ).toBeVisible();
    await page.getByLabel("Until").selectOption("7");
    await page.getByLabel("Most reminders per day").selectOption("3");
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByText("Preferences saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("From")).toHaveValue("22");
    await expect(page.getByLabel("Until")).toHaveValue("7");
    await expect(page.getByLabel("Most reminders per day")).toHaveValue("3");

    // The economic calendar digest is opt-in, with currencies and a send time.
    const digest = page.locator("#digest");
    await expect(digest.getByLabel("Send me the daily digest")).not.toBeChecked();
    await digest.getByLabel("USD").uncheck();
    await digest.getByRole("button", { name: "Save digest" }).click();
    await expect(digest.getByText("Choose at least one currency and a time.")).toBeVisible();
    await digest.getByLabel("Send me the daily digest").check();
    await digest.getByLabel("EUR").check();
    await digest.getByLabel("GBP").check();
    await digest.getByLabel("Send at (your time)").selectOption("6");
    await digest.getByRole("button", { name: "Save digest" }).click();
    await expect(digest.getByText("Digest settings saved.")).toBeVisible();
    await page.reload();
    await expect(page.locator("#digest").getByLabel("Send me the daily digest")).toBeChecked();
    await expect(page.locator("#digest").getByLabel("EUR")).toBeChecked();
    await expect(page.locator("#digest").getByLabel("USD")).not.toBeChecked();
    await expect(page.locator("#digest").getByLabel("Send at (your time)")).toHaveValue("6");
  } finally {
    await deleteUser(id);
  }
});
