import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { setupTestDb, service, superuser, user, pgError } from "./support/db";
const db = setupTestDb();
it("serializes purchases, allocates stock FIFO, and refunds cancellation once", async () => {
  const buyer = await db.createUser(),
    staff = await db.createUser();
  await db.as(user(buyer), "select complete_onboarding('GB','UTC',true)");
  await db.as(superuser, "insert into admin_roles(user_id,role) values($1,'finance')", [staff]);
  const firm = (
    await db.as(
      superuser,
      "insert into firms(slug,name,asset_classes,published_at) values('reward-test','Reward test','{futures}',now()) returning id",
    )
  ).rows[0]!.id;
  const program = (
    await db.as(
      superuser,
      "insert into firm_programs(firm_id,name,account_size,steps,list_price_cents,drawdown_type,payout_frequency,published_at) values($1,'Test',10000,1,15000,'static','monthly',now()) returning id",
      [firm],
    )
  ).rows[0]!.id;
  const reward = (
    await db.as(
      superuser,
      "insert into rewards(name,description,instructions,kind,program_id,cost_coins,active) values('Voucher','Test','Use at checkout','free_challenge_voucher',$1,900,true) returning id",
      [program],
    )
  ).rows[0]!.id;
  const key = randomUUID();
  const redeem = (request: string) =>
    db.as(service, "select redeem_reward($1,$2,$3,900,'GB') as id", [buyer, reward, request]);
  await expect(redeem(key)).rejects.toThrow(/insufficient coins/);
  await db.as(
    superuser,
    "insert into ledger_entries(wallet_id,amount,bucket,type,ref_type,ref_id,idempotency_key,config_version) values(private.wallet_for($1),1800,'available','fixture','fixture',gen_random_uuid(),'fixture',1)",
    [buyer],
  );
  const [a, b] = await Promise.all([redeem(key), redeem(key)]);
  expect(a.rows).toEqual(b.rows);
  const other = await redeem(randomUUID());
  await expect(redeem(randomUUID())).rejects.toThrow(/insufficient/);
  await db.as(service, "select stock_vouchers($1,$2,$3,null,'Partner stock','test')", [
    staff,
    reward,
    JSON.stringify([{ ciphertext: "encrypted-test", hash: "a".repeat(64) }]),
  ]);
  expect(
    (await db.as(user(buyer), "select status from redemptions where id=$1", [a.rows[0]!.id]))
      .rows[0]!.status,
  ).toBe("fulfilled");
  expect((await pgError(db.as(user(buyer), "select ciphertext from voucher_inventory"))).code).toBe(
    "42501",
  );
  await Promise.all(
    [1, 2].map(() =>
      db.as(service, "select cancel_redemption($1,$2,'Owner requested cancellation','test')", [
        staff,
        other.rows[0]!.id,
      ]),
    ),
  );
  expect(
    (await db.as(user(buyer), "select available from wallet_balances")).rows[0]!.available,
  ).toBe("900");
  expect(
    (
      await db.as(
        user(buyer),
        "select detail from notifications where kind='redemption_status' order by id",
      )
    ).rows.map((r) => r.detail),
  ).toEqual(["pending", "pending", "fulfilled", "cancelled"]);
  expect((await db.as(user(await db.createUser()), "select * from redemptions")).rows).toEqual([]);
});
