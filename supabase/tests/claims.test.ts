import { randomUUID } from "node:crypto";
import { beforeAll, expect, it } from "vitest";
import { setupTestDb, service, superuser, user, pgError } from "./support/db";
const db = setupTestDb();
let program: string;
let actor: string;
beforeAll(async () => {
  const firm = (
    await db.as(
      superuser,
      "insert into firms(slug,name,asset_classes,published_at) values('fiction','Fictional test firm','{forex}',now()) returning id",
    )
  ).rows[0]!.id;
  await db.as(
    superuser,
    "insert into firm_agreements values($1,'https://example.test/affiliate',null,1500,true,'https://example.test/proof')",
    [firm],
  );
  program = (
    await db.as(
      superuser,
      "insert into firm_programs(firm_id,name,account_size,steps,list_price_cents,drawdown_type,payout_frequency,published_at) values($1,'Test',50000,2,15000,'static','monthly',now()) returning id",
      [firm],
    )
  ).rows[0]!.id;
  actor = await db.createUser();
  await db.as(user(actor), "select complete_onboarding('GB','UTC',true)");
});
it("enforces region checks before logging a click with the price snapshot", async () => {
  const sql = "select * from record_outbound($1,$2,$3,$4,'firm')";
  expect((await pgError(db.as(service, sql, [null, program, "IN", "GB"]))).code).toBe("42501");
  const r = await db.as(service, sql, [actor, program, "GB", null]);
  expect(r.rows[0]?.tracking_url).toBe("https://example.test/affiliate");
});
it("rejects order and file reuse, and exposes the tracker only to the claimant", async () => {
  const submit = (ref: string, hash: string) => {
    const id = randomUUID();
    return db.as(
      service,
      "select submit_claim($1,$2,$3,'GB',$4,15000,current_date,'test@example.test',$5,$6)",
      [id, actor, program, ref, actor + "/" + id + ".png", hash],
    );
  };
  await submit("Order-42", "a".repeat(64));
  expect((await pgError(submit(" order-42 ", "b".repeat(64)))).code).toBe("23505");
  expect((await pgError(submit("other", "a".repeat(64)))).code).toBe("23505");
  expect(
    (await db.as(user(actor), "select detail from notifications where kind='claim_status'")).rows,
  ).toEqual([{ detail: "submitted" }]);
  expect((await db.as(user(actor), "select status from purchase_claims")).rows).toEqual([
    { status: "submitted" },
  ]);
  expect((await db.as(user(await db.createUser()), "select * from purchase_claims")).rowCount).toBe(
    0,
  );
});
