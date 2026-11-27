import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  adminClient,
  deleteUser,
  e2eEmail,
  endHold,
  enrollMfa,
  grantOwner,
  signIn,
} from "./support/auth";

/*
 * The core loop end to end (CLAUDE.md §4): sign-up → check-in → claim → admin confirm → redeem.
 *
 * Every member and staff step runs through the real UI. Fixtures are limited to what no browser
 * can produce on staging: a partner firm with a live agreement (a real one needs the owner's
 * contract) and a reward for its program. The hold period is ended for this one commission
 * only, by moving its release time, so the global economy settings are never touched; the real
 * release job then moves the Coins.
 */

async function onboard(page: Page) {
  await page.getByLabel("Country of residence").selectOption("GB");
  await page.getByLabel(/I'm 18 or older/).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForURL(/\/today$/);
}

test("sign-up, check-in, claim, staff confirmation and voucher redemption", async ({
  page,
  browser,
  baseURL,
}, info) => {
  test.setTimeout(180_000);
  const db = adminClient();
  const run = randomUUID().slice(0, 8);
  const slug = `e2e-journey-${run}`;
  const firmName = `E2E Journey ${run}`;
  const orderRef = `E2E-ORDER-${run}`;
  const voucher = `E2E-VOUCHER-${run}-${info.project.name}`;
  const users: string[] = [];
  const firm = randomUUID(),
    program = randomUUID();
  const rewardName = `Journey voucher ${run}`;
  let staffId: string | null = null;
  const staffContext = await browser.newContext({ baseURL, viewport: page.viewportSize() });

  try {
    // Fixtures: a published partner firm with a live agreement and one program.
    const created = [
      await db.from("firms").insert({
        id: firm,
        slug,
        name: firmName,
        asset_classes: ["futures"],
        published_at: new Date().toISOString(),
      }),
      await db.from("firm_agreements").insert({
        firm_id: firm,
        tracking_url: "https://example.com/e2e-partner",
        commission_bps: 1500,
        rebate_permission: true,
        evidence_url: "https://example.com/e2e-permission",
      }),
      await db.from("firm_programs").insert({
        id: program,
        firm_id: firm,
        name: "Journey 10K",
        account_size: 10000,
        steps: 1,
        list_price_cents: 15000,
        drawdown_type: "static",
        payout_frequency: "monthly",
        published_at: new Date().toISOString(),
      }),
    ];
    for (const r of created) expect(r.error).toBeNull();

    // 1. Sign up and onboard.
    const member = await signIn(page, e2eEmail("journey"), "/today");
    users.push(member);
    await onboard(page);

    // 2. Daily check-in.
    await page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(page.getByRole("button", { name: "Checked in today" })).toBeDisabled();

    // 3. Get the deal: the outbound click is logged and the firm opens in a new tab.
    await page.goto(`/firms/${slug}`);
    await page.getByRole("button", { name: "Get this deal" }).first().click();
    const sheet = page.getByRole("dialog");
    const popup = page.waitForEvent("popup");
    await sheet.getByRole("button", { name: /Continue to firm/ }).click();
    await (await popup).close();
    await sheet.getByRole("link", { name: /Return here with your receipt/ }).click();
    await page.waitForURL(/\/claims\?program=/);

    // 4. Claim the purchase with a receipt.
    await page.getByLabel("Order reference").fill(orderRef);
    await page.getByLabel("Purchase date").fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Amount paid").fill("150.00");
    await page.getByLabel("Checkout email").fill(`buyer-${run}@example.com`);
    await page.getByLabel(/^Receipt/).setInputFiles({
      name: "receipt.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(`%PDF-1.4\n% E2E receipt ${orderRef} ${info.project.name}\n%%EOF\n`),
    });
    await page.getByRole("button", { name: "Submit claim" }).click();
    await expect(page.getByText(orderRef).first()).toBeVisible();
    await expect(page.getByText("Submitted").first()).toBeVisible();

    // 5. Staff: an owner with two-factor approves the claim.
    const staff = await staffContext.newPage();
    const staffEmail = e2eEmail("journey-staff");
    staffId = await signIn(staff, staffEmail, "/today");
    users.push(staffId);
    await onboard(staff);
    await grantOwner(staffEmail);
    await staff.goto("/admin");
    await enrollMfa(staff);
    await expect(staff.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

    await staff.goto("/admin/claims");
    const claimRow = staff.getByRole("listitem").filter({ hasText: orderRef });
    await claimRow.getByLabel("Review decision").selectOption("approved");
    await claimRow.getByLabel("Reason shown to the trader").fill("Receipt and order match.");
    await claimRow.getByRole("button", { name: "Save decision" }).click();
    // A decided claim leaves the review queue.
    await expect(claimRow).toHaveCount(0);

    // 6. Finance: import the firm's commission report and confirm the matched purchase.
    await staff.goto("/admin/finance");
    const firmSelect = staff.locator('select[name="firm"]');
    await firmSelect.selectOption({ label: firmName });
    await staff.getByLabel(/USD commission report/).setInputFiles({
      name: "report.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(`txn,order,usd\nTX-${run},${orderRef},22.50\n`),
    });
    await staff.getByLabel("Transaction ID column").selectOption("txn");
    await staff.getByLabel("Order reference column").selectOption("order");
    await staff.getByLabel("Commission in USD column").selectOption("usd");
    const importForm = staff.locator("form").filter({ has: firmSelect });
    await importForm.getByLabel("Reason for audit log").fill("Partner statement (e2e)");
    await staff.getByRole("button", { name: "Import commission report" }).click();
    await expect(
      staff.getByText("Report recorded. Review the matched claims below."),
    ).toBeVisible();

    const commissionRow = staff
      .getByRole("listitem")
      .filter({ has: staff.getByRole("heading", { name: `${firmName} · ${orderRef}` }) });
    await expect(commissionRow.getByText("Match confidence 100%")).toBeVisible();
    await commissionRow.getByText("Review transaction").click();
    await commissionRow.getByLabel("Reason for audit log").fill("Verified against the statement.");
    await commissionRow.getByRole("button", { name: "Confirm commission" }).click();
    await expect(commissionRow.getByRole("status")).toHaveText("Decision saved.");

    // The firm pays: finance records the payout against the confirmed commission.
    await staff.reload();
    await commissionRow.getByLabel(/Include in payment/).check();
    const paidForm = staff.locator("form#mark-paid");
    await paidForm.getByLabel("Payout reference").fill(`PAYOUT-${run}`);
    await paidForm.getByLabel("Reason for audit log").fill("Partner payout (e2e)");
    await paidForm.getByRole("button", { name: "Mark selected as paid" }).click();
    await expect(paidForm.getByRole("status")).toHaveText("Payment recorded.");
    await staff.reload();
    await expect(commissionRow.getByText(`· PAYOUT-${run}`)).toBeVisible();

    // 7. The hold ends for this commission only, then the real release job runs.
    const claim = await db
      .from("purchase_claims")
      .select("id")
      .eq("order_ref", orderRef)
      .eq("user_id", member)
      .single();
    expect(claim.error).toBeNull();
    await endHold(claim.data!.id);
    const release = await db.rpc("release_pending_coins", { p_limit: 500 });
    expect(release.error).toBeNull();

    // 8. Staff creates the reward for this program and stocks it with an encrypted code.
    await staff.goto("/admin/rewards?new=1");
    await staff.getByLabel("Reward name").fill(rewardName);
    await staff.getByLabel("Description").fill("End-to-end test voucher");
    await staff.getByLabel("Redemption instructions").fill("Use at checkout");
    await staff.getByLabel("Price in Coins").fill("100");
    await staff.getByLabel("Program").selectOption({ label: `${firmName} · Journey 10K` });
    await staff.getByLabel("Available to members").check();
    await staff.getByLabel("Reason for audit log").fill("E2E reward");
    await staff.getByRole("button", { name: "Save reward" }).click();
    await staff.waitForURL(/\/admin\/rewards\?id=.+&saved=1/);
    await staff.getByLabel(/Voucher codes, one per line/).fill(voucher);
    const stockForm = staff
      .locator("form")
      .filter({ has: staff.getByLabel(/Voucher codes, one per line/) });
    await stockForm.getByLabel("Reason for audit log").fill("E2E stock");
    await stockForm.getByRole("button", { name: "Add voucher stock" }).click();
    await expect(
      stockForm.getByText("Inventory updated and waiting redemptions processed."),
    ).toBeVisible();

    // 9. The member sees available Coins, redeems the voucher and reveals the code.
    await page.goto("/claims");
    await expect(page.getByText("Coins available").first()).toBeVisible();
    await page.goto("/rewards");
    const item = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: rewardName }) });
    await item.getByText("Redeem", { exact: true }).click();
    await item.getByRole("button", { name: "Confirm redemption" }).click();
    await expect(item.getByRole("status")).toHaveText(
      "Redemption recorded. See your redemptions below.",
    );
    await page.reload();
    await page.getByRole("button", { name: "Reveal voucher code" }).first().click();
    await expect(page.locator("output").filter({ hasText: voucher })).toBeVisible();
  } finally {
    await staffContext.close();
    // Take the fixtures out of every public and member view; ledger history stays append-only.
    const left = await db
      .from("rewards")
      .select("*")
      .eq("name", rewardName)
      .eq("active", true)
      .maybeSingle();
    if (left.data && staffId) {
      const { id, revision, ...r } = left.data;
      await db.rpc("admin_save_reward", {
        p_actor: staffId,
        p_id: id,
        p_revision: revision,
        p_values: {
          name: r.name,
          description: r.description,
          instructions: r.instructions,
          kind: r.kind,
          program_id: r.program_id,
          cost_coins: r.cost_coins,
          per_user_limit: r.per_user_limit,
          min_tier: r.min_tier,
          low_stock: r.low_stock,
          countries: r.countries,
          starts_at: r.starts_at,
          ends_at: r.ends_at,
          active: false,
        },
        p_reason: "E2E cleanup",
        p_request_id: randomUUID(),
      });
    }
    await db.from("firms").update({ published_at: null, status: "delisted" }).eq("id", firm);
    for (const id of users) await deleteUser(id);
  }
});
