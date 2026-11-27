import { expect, it } from "vitest";
import { setupTestDb, superuser } from "./support/db";
const db = setupTestDb();
it.each([
  [9000, 0, true, 2025, 112],
  [6800, 0, false, 1530, 225],
  [6800, 500, false, 1642, 225],
] as const)(
  "allocates confirmed commission under the aggregate cap",
  async (base, boost, season, buyer, referral) => {
    const result = await db.as(
      superuser,
      "select * from private.coin_split(2250,$1,$2,$3,1000,0,9500)",
      [base, boost, season],
    );
    expect(result.rows).toEqual([{ buyer, referral, creator: 0 }]);
  },
);

it("credits once, respects the hold and a watch status, then releases and reverses exactly once", async () => {
  const finance = await db.createUser(),
    buyer = await db.createUser();
  await db.as(superuser, "insert into admin_roles(user_id,role) values($1,'finance')", [finance]);
  const firm = (
    await db.as(
      superuser,
      "insert into firms(slug,name,asset_classes,published_at) values('ledger-test','Ledger test','{futures}',now()) returning id",
    )
  ).rows[0]!.id;
  await db.as(
    superuser,
    "insert into firm_agreements(firm_id,rebate_permission,evidence_url) values($1,true,'https://example.test/proof')",
    [firm],
  );
  const program = (
    await db.as(
      superuser,
      "insert into firm_programs(firm_id,name,account_size,steps,list_price_cents,drawdown_type,payout_frequency) values($1,'Test',10000,1,15000,'static','monthly') returning id",
      [firm],
    )
  ).rows[0]!.id;
  await db.as(
    superuser,
    "insert into purchase_claims(user_id,firm_id,program_id,order_ref,amount_paid_cents,currency,expected_cents,purchased_on,status) values($1,$2,$3,'ABC',15000,'USD',15000,current_date,'approved')",
    [buyer, firm, program],
  );
  const report = (
    await db.as(
      superuser,
      "select finance_record_commission($1,$2,'external','abc',2250,'Partner report','test') as id",
      [finance, firm],
    )
  ).rows[0]!.id;
  const confirm = () =>
    db.as(superuser, "select confirm_commission($1,$2,'Checked report','test')", [finance, report]);
  await Promise.all([confirm(), confirm()]);
  const balance = async () =>
    (
      await db.as(superuser, "select pending,available from wallet_balances where user_id=$1", [
        buyer,
      ])
    ).rows[0];
  expect(await balance()).toEqual({ pending: "1350", available: "0" });
  const release = () => db.as(superuser, "select release_pending_coins(1) as n");
  expect((await release()).rows[0]!.n).toBe(0);
  await db.as(superuser, "update commissions set release_at=now() where id=$1", [report]);
  await db.as(superuser, "update firms set status='watch' where id=$1", [firm]);
  expect((await release()).rows[0]!.n).toBe(0);
  await db.as(superuser, "update firms set status='active' where id=$1", [firm]);
  await Promise.all([release(), release()]);
  expect(await balance()).toEqual({ pending: "0", available: "1350" });
  await expect(db.as(superuser, "update ledger_entries set amount=1")).rejects.toThrow(
    /append-only/,
  );
  await Promise.all(
    [1, 2].map(() =>
      db.as(superuser, "select reverse_commission($1,$2,'Firm clawed back','test')", [
        finance,
        report,
      ]),
    ),
  );
  expect(await balance()).toEqual({ pending: "0", available: "0" });
  expect((await db.as(superuser, "select * from ledger_entries")).rowCount).toBe(4);
});
