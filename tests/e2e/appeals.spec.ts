import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { adminClient, deleteUser, e2eEmail, enrollMfa, grantOwner, signIn } from "./support/auth";

async function onboard(page: Page) {
  await page.getByLabel("Country of residence").selectOption("GB");
  await page.getByLabel(/I'm 18 or older/).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

test("member appeals a rejected claim and a reviewer approves it", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  test.setTimeout(75000);
  const db = adminClient();
  const memberIds: string[] = [];
  const claim = randomUUID(),
    reference = "E2E-appeal-" + claim;
  const reviewerContext = await browser.newContext({ baseURL, viewport: page.viewportSize() });
  try {
    const buyer = await signIn(page, e2eEmail("appeal"), "/claims");
    memberIds.push(buyer);
    await onboard(page);
    await expect(page.getByRole("heading", { name: "Purchase claims", exact: true })).toBeVisible();
    const firm = await db
      .from("firms")
      .select("id")
      .eq("slug", "sample-paper-kite")
      .eq("is_sample", true)
      .single();
    expect(firm.error).toBeNull();
    const program = await db
      .from("firm_programs")
      .select("id")
      .eq("firm_id", firm.data!.id)
      .limit(1)
      .single();
    expect(program.error).toBeNull();
    // A private rejected claim fixture can exercise appeals without a sale or a real receipt.
    const inserted = await db.from("purchase_claims").insert({
      id: claim,
      user_id: buyer,
      firm_id: firm.data!.id,
      program_id: program.data!.id,
      order_ref: reference,
      purchased_on: new Date().toISOString().slice(0, 10),
      amount_paid_cents: 15000,
      expected_cents: 15000,
      currency: "USD",
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      review_note: "The supplied reference did not match.",
    });
    expect(inserted.error).toBeNull();
    await page.reload();
    await page.getByText("Appeal this decision", { exact: true }).click();
    await page
      .getByLabel(/New evidence/)
      .fill("The updated invoice includes the previously missing order reference.");
    await page.getByRole("button", { name: "Submit appeal" }).click();
    await expect(page.getByText("Appeal awaiting review", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Appeal this decision", { exact: true })).toHaveCount(0);
    const reviewer = await reviewerContext.newPage(),
      email = e2eEmail("appeal-reviewer");
    memberIds.push(await signIn(reviewer, email, "/today"));
    await onboard(reviewer);
    await expect(reviewer).toHaveURL(/\/today$/);
    await grantOwner(email);
    await reviewer.goto("/admin");
    await enrollMfa(reviewer);
    await expect(reviewer.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await reviewer.goto("/admin/claims");
    await reviewer.getByRole("link", { name: "Claim appeals" }).click();
    const row = reviewer
      .getByRole("listitem")
      .filter({ has: reviewer.getByRole("heading", { name: "Order " + reference, exact: true }) });
    await expect(row.getByText("The supplied reference did not match.")).toBeVisible();
    await expect(row.getByText(/The updated invoice includes/)).toBeVisible();
    await row.getByLabel("Appeal decision", { exact: true }).selectOption("overturn");
    await row
      .getByLabel("Reason shown to the member")
      .fill("The corrected reference matches the order.");
    await row.getByRole("button", { name: "Save appeal decision" }).click();
    await expect(row).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Appeal decided · claim approved")).toBeVisible();
    await expect(page.getByText("The corrected reference matches the order.")).toBeVisible();
    await context.clearCookies();
  } finally {
    await reviewerContext.close();
    const result = await db
      .from("purchase_claims")
      .delete()
      .eq("id", claim)
      .eq("order_ref", reference);
    for (const id of memberIds) await deleteUser(id);
    expect(result.error).toBeNull();
  }
});
