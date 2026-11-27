import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { setupTestDb, service, superuser, user } from "./support/db";

const db = setupTestDb();

it("marks confirmed commissions paid once, audited, and reports reconciliation gaps", async () => {
  const finance = await db.createUser();
  const member = await db.createUser();
  await db.as(superuser, "insert into admin_roles(user_id,role) values($1,'finance')", [finance]);
  const firm = randomUUID(),
    program = randomUUID();
  await db.as(
    superuser,
    "insert into firms(id,slug,name,asset_classes,published_at) values($1,'paid','Paid Firm','{futures}',now())",
    [firm],
  );
  await db.as(
    superuser,
    "insert into firm_programs(id,firm_id,name,account_size,steps,list_price_cents,drawdown_type,payout_frequency,published_at) values($1,$2,'P',10000,1,15000,'static','monthly',now())",
    [program, firm],
  );
  const add = async (ref: string, status: string, confirmedDaysAgo: number | null) =>
    (
      await db.as<{ id: string }>(
        superuser,
        `insert into commissions(firm_id,external_ref,order_ref,amount_cents,status,confirmed_at)
         values($1,$2,$2,2250,$3,case when $4::int is null then null else now()-make_interval(days=>$4::int) end)
         returning id`,
        [firm, ref, status, confirmedDaysAgo],
      )
    ).rows[0]!.id;
  const confirmed = await add("C-1", "confirmed", 50);
  const released = await add("C-2", "released", 2);
  const reported = await add("C-3", "reported", null);

  // Reconciliation before payment: C-1 is unpaid after 45 days; C-3 matches no claim.
  const issues = async () =>
    (
      await db.as<{ issue: string; order_ref: string }>(
        service,
        "select issue,order_ref from commission_reconciliation where firm_id=$1 order by issue,order_ref",
        [firm],
      )
    ).rows;
  expect(await issues()).toEqual([
    { issue: "commission_without_claim", order_ref: "C-3" },
    { issue: "unpaid", order_ref: "C-1" },
  ]);

  // An approved claim with no commission after 7 days is reported too.
  await db.as(
    superuser,
    "insert into purchase_claims(user_id,firm_id,program_id,order_ref,purchased_on,amount_paid_cents,expected_cents,currency,status,reviewed_at) values($1,$2,$3,'NO-COMM',current_date-10,15000,15000,'USD','approved',now()-interval '8 days')",
    [member, firm, program],
  );
  expect((await issues()).map((r) => r.issue)).toContain("claim_without_commission");

  const mark = (ids: string[], actor = finance) =>
    db.as<{ n: number }>(
      service,
      "select mark_commissions_paid($1,$2::uuid[],'PAYOUT-7',current_date,'Bank statement line 7','req') as n",
      [actor, ids],
    );
  // Only confirmed or released commissions are marked; the reported one is skipped.
  expect((await mark([confirmed, released, reported])).rows[0]!.n).toBe(2);
  // A retry changes nothing.
  expect((await mark([confirmed, released])).rows[0]!.n).toBe(0);

  const { rows: paid } = await db.as(
    service,
    "select order_ref,paid_reference from commissions where paid_at is not null order by order_ref",
  );
  expect(paid).toEqual([
    { order_ref: "C-1", paid_reference: "PAYOUT-7" },
    { order_ref: "C-2", paid_reference: "PAYOUT-7" },
  ]);
  expect((await issues()).map((r) => r.issue)).not.toContain("unpaid");
  const { rows: totals } = await db.as(service, "select paid_cents from finance_totals");
  expect(totals[0]!.paid_cents).toBe("4500");
  const { rows: audit } = await db.as(
    service,
    "select count(*)::int as n from audit_log where action='commission.mark_paid'",
  );
  expect(audit[0]!.n).toBe(1);

  // Members cannot mark payments, read reconciliation, or call the function directly.
  await expect(mark([confirmed], member)).rejects.toThrow(/permission/);
  await expect(db.as(user(member), "select * from commission_reconciliation")).rejects.toThrow(
    /permission/,
  );
  await expect(
    db.as(
      user(member),
      "select mark_commissions_paid($1,$2::uuid[],'X',current_date,'reason','r')",
      [member, [confirmed]],
    ),
  ).rejects.toThrow(/permission/);
});
