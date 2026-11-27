import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { setupTestDb, service, superuser, user } from "./support/db";

const db = setupTestDb();

it("reconciles an imported commission with both wallets after an immediately fulfilled redemption", async () => {
  const staff = await db.createUser();
  const referrer = await db.createUser();
  const { rows: profiles } = await db.as(
    user(referrer),
    "select referral_code from profiles where id=$1",
    [referrer],
  );
  const buyer = await db.createUser({ ref: profiles[0]!.referral_code });
  await db.as(user(buyer), "select complete_onboarding('GB','UTC',true)");
  await db.as(service, "select daily_checkin($1)", [buyer]);
  await db.as(superuser, "insert into admin_roles(user_id,role) values($1,'owner')", [staff]);

  // This entire database is disposable. Keep the real catalogue and live holds untouched.
  const firm = randomUUID(),
    program = randomUUID(),
    reward = randomUUID(),
    claim = randomUUID();
  await db.as(
    superuser,
    "insert into firms(id,slug,name,asset_classes,published_at) values($1,'fixture','Fixture','{futures}',now())",
    [firm],
  );
  await db.as(
    superuser,
    "insert into firm_agreements(firm_id,tracking_url,commission_bps,rebate_permission,evidence_url) values($1,'https://example.test/partner',1500,true,'https://example.test/permission')",
    [firm],
  );
  await db.as(
    superuser,
    "insert into firm_programs(id,firm_id,name,account_size,steps,list_price_cents,drawdown_type,payout_frequency,published_at) values($1,$2,'Fixture',10000,1,15000,'static','monthly',now())",
    [program, firm],
  );
  await db.as(
    service,
    "select save_economy_settings($1,1,'{\"hold_days\":0}','Same-day test window','test')",
    [staff],
  );
  await db.as(
    superuser,
    "insert into rewards(id,name,description,instructions,kind,program_id,cost_coins,active) values($1,'Fixture voucher','Fixture','Use at checkout','free_challenge_voucher',$2,900,true)",
    [reward, program],
  );
  await db.as(service, "select stock_vouchers($1,$2,$3,null,'Fixture stock','test')", [
    staff,
    reward,
    JSON.stringify([{ ciphertext: "test-ciphertext", hash: "a".repeat(64) }]),
  ]);

  await db.as(service, "select * from record_outbound($1,$2,'GB','GB','catalogue')", [
    buyer,
    program,
  ]);
  await db.as(
    service,
    "select submit_claim($1,$2,$3,'GB','ORDER-1',15000,(now() at time zone 'UTC')::date,null,$4,$5)",
    [claim, buyer, program, buyer + "/" + claim + ".pdf", "b".repeat(64)],
  );
  await db.as(service, "select review_claim($1,$2,'approved','Proof checked','test')", [
    staff,
    claim,
  ]);
  await db.as(service, "select import_commissions($1,$2,$3,'{}',$4,'Partner statement','test')", [
    staff,
    firm,
    "c".repeat(64),
    JSON.stringify([{ external: "C1", order: "ORDER-1", cents: 2250 }]),
  ]);
  const { rows: matches } = await db.as(
    service,
    "select id,candidate_id,confidence from commission_matches",
  );
  expect(matches[0]).toMatchObject({ candidate_id: claim, confidence: 100 });
  await db.as(service, "select confirm_commission($1,$2,'Verified report','test')", [
    staff,
    matches[0]!.id,
  ]);
  const totals = async () =>
    (
      await db.as(
        service,
        "select confirmed_cents,pending,available,liability_ratio from finance_totals",
      )
    ).rows[0]!;
  expect(await totals()).toMatchObject({
    confirmed_cents: "2250",
    pending: "1575",
    available: "0",
  });
  await db.as(service, "select release_pending_coins(10)");
  await db.as(service, "select redeem_reward($1,$2,$3,900,'GB')", [buyer, reward, randomUUID()]);
  const balance = async (id: string) =>
    (await db.as(user(id), "select available from wallet_balances")).rows[0]!.available;
  expect(await balance(buyer)).toBe("450");
  expect(await balance(referrer)).toBe("225");
  expect(
    (await db.as(user(buyer), "select detail from notifications where kind='redemption_status'"))
      .rows,
  ).toEqual([{ detail: "fulfilled" }]);
  expect(
    (
      await db.as(
        service,
        "select count(*)::int as n from voucher_inventory where redemption_id is not null",
      )
    ).rows[0]!.n,
  ).toBe(1);
  const after = await totals();
  expect(after).toMatchObject({ pending: "0", available: "675", confirmed_cents: "2250" });
  expect(Number(after.liability_ratio)).toBe(0.3);

  // A second order and retried confirmations must never generate a second referral award.
  const secondClaim = randomUUID();
  await db.as(
    service,
    "select submit_claim($1,$2,$3,'GB','ORDER-2',15000,current_date,null,$4,$5)",
    [secondClaim, buyer, program, buyer + "/" + secondClaim + ".pdf", "d".repeat(64)],
  );
  await db.as(service, "select review_claim($1,$2,'approved','Proof checked','test')", [
    staff,
    secondClaim,
  ]);
  const secondReport = (
    await db.as(
      service,
      "select finance_record_commission($1,$2,'C2','ORDER-2',2250,'Partner statement','test') as id",
      [staff, firm],
    )
  ).rows[0]!.id;
  await Promise.all(
    [1, 2].map(() =>
      db.as(service, "select confirm_commission($1,$2,'Verified report','test')", [
        staff,
        secondReport,
      ]),
    ),
  );
  const credits = await db.as(
    user(referrer),
    "select amount from ledger_entries where type='referral'",
  );
  expect(credits.rows).toEqual([{ amount: 225 }]);
  const xp = await db.as(
    user(referrer),
    "select amount from xp_events where source='verified_referral'",
  );
  expect(xp.rows).toEqual([{ amount: 300 }]);
});
