import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { deleteUser, e2eEmail, enrollMfa, grantOwner, signIn } from "./support/auth";

/** Phase 0 done criteria: sign up → onboarding → empty Today; staff reach the admin shell. */
test.describe("account", () => {
  const created: string[] = [];
  test.afterAll(async () => {
    for (const id of created) await deleteUser(id);
  });

  test("new user onboards with country, timezone and 18+, then sees an empty Today", async ({
    page,
  }) => {
    const email = e2eEmail("onboard");
    created.push(await signIn(page, email, "/today"));

    await expect(page).toHaveURL(/\/onboarding\?next=%2Ftoday/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Before you start");

    // Submitting without the 18+ confirmation is refused beside the field.
    await page.getByLabel("Country of residence").selectOption("GB");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("You must be 18 or older to use this site.")).toBeVisible();

    await expect(page.getByLabel("Country of residence")).toHaveValue("GB");
    await page.getByLabel(/I'm 18 or older/).check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByText("Daily check-in")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Opens at launch" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Level progress" })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
    await page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(page.getByRole("button", { name: "Checked in today" })).toBeDisabled();
    await page.reload();
    await expect(page.getByRole("progressbar", { name: "Level progress" })).toHaveAttribute(
      "aria-valuenow",
      "60",
    );
    await page.getByRole("link", { name: "Use a calculator" }).click();
    await expect(page).toHaveURL(/\/tools$/);
    await page.getByRole("link", { name: /Risk\/reward calculator/ }).click();
    await page.getByLabel("Loss per losing trade").fill("50");
    await page.getByLabel("Gain per winning trade").fill("100");
    await expect(page.getByText("33.333%")).toBeVisible();
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Counted toward today's calculator mission.")).toBeVisible();
    await expect(page).toHaveURL(/loss=50&gain=100/);
    await page.goto("/today");
    await expect(page.getByRole("progressbar", { name: "Level progress" })).toHaveAttribute(
      "aria-valuenow",
      "80",
    );

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(
      results.violations.flatMap((v) =>
        v.nodes.map((n) => `${v.id}: ${n.target.join(" ")} ${n.failureSummary ?? ""}`),
      ),
    ).toEqual([]);

    await page.goto("/rewards");
    await expect(page.getByRole("heading", { name: "Reward catalogue" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your redemptions" })).toBeVisible();
    await page.getByRole("link", { name: /available/i }).click();
    await expect(page.getByRole("heading", { name: "Coin activity" })).toBeVisible();
    await page.goto("/profile");
    await expect(page.getByText("United Kingdom")).toBeVisible();
    await page.getByRole("link", { name: "Notifications", exact: true }).click();
    const preference = page.getByLabel("Purchase claim updates");
    await expect(preference).toBeChecked();
    await preference.uncheck();
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByText("Preferences saved.")).toBeVisible();
    await page.reload();
    await expect(preference).not.toBeChecked();
    await page.goto("/profile");
    const invite = await page
      .getByRole("textbox", { name: "Your member referral link" })
      .inputValue();
    const referral = new URL(invite).searchParams.get("ref");
    expect(referral).toMatch(/^[A-Z0-9]{6,16}$/);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/today");
    await expect(page).toHaveURL(/\/sign-in/);
    const codeField = page.getByLabel("Referral code (optional)");
    await expect(codeField).toHaveValue("");
    await page.goto(invite);
    await expect(codeField).toHaveValue(referral!);
    await codeField.fill("BAD");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(codeField).toBeFocused();
    await expect(codeField).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(/We couldn’t find that member code/)).toBeVisible();
    await codeField.fill(referral!.toLowerCase());
    // Stop at the OAuth provider boundary. No Google credentials are needed for this check.
    await page.route("**/auth/v1/authorize?**", (route) =>
      route.fulfill({ status: 200, contentType: "text/plain", body: "Provider handoff" }),
    );
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(/\/auth\/v1\/authorize\?.*provider=google/);
    const inviteCookies = await page.context().cookies(new URL("/auth/callback", invite).href);
    expect(
      inviteCookies.some(
        (c) => c.name === "fundback_google_invite" && c.httpOnly && c.sameSite === "Lax",
      ),
    ).toBe(true);
  });

  test("non-staff get 403 on admin; an owner is sent to set up two-factor first", async ({
    page,
  }) => {
    const email = e2eEmail("admin");
    const id = await signIn(page, email, "/admin");
    created.push(id);
    await page.getByLabel("Country of residence").selectOption("GB");
    await expect(page.getByLabel("Country of residence")).toHaveValue("GB");
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

    await enrollMfa(page);
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    // The dashboard card also says "See System health"; this is the nav link.
    await page.getByRole("link", { name: "System health", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Email delivery" })).toBeVisible();
    await page
      .getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: "Rewards", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Rewards and inventory" })).toBeVisible();
    await page.getByRole("link", { name: "Add reward" }).click();
    await expect(page.getByRole("heading", { name: "Add reward" })).toBeVisible();
    await page.getByRole("link", { name: "Economy", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Economy settings" })).toBeVisible();
    await page.getByRole("link", { name: "Catalogue", exact: true }).click();
    await page.getByRole("link", { name: /Paper Kite/ }).click();
    await expect(page.getByLabel("URL slug")).toHaveValue("sample-paper-kite");
    await page.getByRole("link", { name: "Sample evaluation", exact: true }).click();
    await expect(page.getByLabel("List price in minor units")).toHaveValue("15000");
  });
});
