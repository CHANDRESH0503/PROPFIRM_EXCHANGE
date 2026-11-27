import { readFileSync } from "node:fs";
import { expect, it, beforeAll } from "vitest";
import { setupTestDb, superuser, anon, pgError } from "./support/db";

const db = setupTestDb();
const seed = readFileSync("supabase/seed.sql", "utf8");
beforeAll(async () => {
  await db.pool.query(seed);
  await db.pool.query(seed);
});

it("publishes three fictional firms and records one initial price per program on repeat seeds", async () => {
  expect((await db.as(anon, "select id from firms where is_sample")).rowCount).toBe(3);
  expect((await db.as(anon, "select id from price_history")).rowCount).toBe(3);
});
it("withholds agreements and offers from direct clients", async () => {
  for (const table of ["firm_agreements", "offers", "offer_programs"]) {
    expect((await pgError(db.as(anon, `select * from ${table}`))).code).toBe("42501");
  }
});
it("hides scheduled firms, programs and prices until publication; records price changes once", async () => {
  const id = "10000000-0000-4000-8000-000000000001";
  await db.as(superuser, "update firms set published_at=now()+interval '1 day' where id=$1", [id]);
  expect((await db.as(anon, "select * from firm_programs where firm_id=$1", [id])).rowCount).toBe(
    0,
  );
  await db.as(superuser, "update firm_programs set list_price_cents=12500 where firm_id=$1", [id]);
  await db.as(superuser, "update firm_programs set list_price_cents=12500 where firm_id=$1", [id]);
  const history =
    "select h.* from price_history h join firm_programs p on p.id=h.program_id where p.firm_id=$1";
  expect((await db.as(anon, history, [id])).rowCount).toBe(0);
  expect((await db.as(superuser, history, [id])).rowCount).toBe(2);
});

it("filters the stricter country and computes integer estimates on the discounted fee only", async () => {
  const id = "10000000-0000-4000-8000-000000000002";
  await db.as(
    superuser,
    "insert into firm_agreements(firm_id,commission_bps,rebate_permission,evidence_url) values($1,1500,true,'https://example.test/permission')",
    [id],
  );
  const offer = await db.as(
    superuser,
    "insert into offers(firm_id,title,terms,code,discount_bps,starts_at,ends_at,published) values($1,'Sample','Sample terms','TEST',1000,now()-interval '1 day',now()+interval '1 day',true) returning id",
    [id],
  );
  await db.as(
    superuser,
    "insert into offer_programs select firm_id,$2,id from firm_programs where firm_id=$1",
    [id, offer.rows[0]!.id],
  );
  const query =
    "select checkout_cents,estimated_coins,net_cents from catalogue_programs($1,$2) where firm_id=$3";
  for (const countries of [
    ["IN", "GB"],
    ["GB", "IN"],
  ])
    expect((await db.as(superuser, query, [...countries, id])).rowCount).toBe(0);
  expect((await db.as(superuser, query, ["GB", "GB", id])).rows[0]).toEqual({
    checkout_cents: 8100,
    estimated_coins: 729,
    net_cents: 7371,
  });
});

it("atomically saves content edits with audit history and rejects stale revisions or unauthorized roles", async () => {
  const actor = await db.createUser();
  const sql = "select admin_save_catalogue($1,'firm',$2,$3,$4,'Verified source','test')";
  const values = {
    name: "Test sample",
    slug: "test-sample",
    asset_classes: ["futures"],
    agreement: { commission_bps: 1000, rebate_permission: false },
  };
  expect((await pgError(db.as(superuser, sql, [actor, null, null, values]))).code).toBe("42501");
  await db.as(superuser, "insert into admin_roles(user_id,role) values($1,'content')", [actor]);
  const id = (await db.as(superuser, sql, [actor, null, null, values])).rows[0]!
    .admin_save_catalogue;
  await db.as(superuser, sql, [actor, id, 1, { name: "Updated" }]);
  expect((await pgError(db.as(superuser, sql, [actor, id, 1, { name: "Stale" }]))).code).toBe(
    "40001",
  );
  await expect(
    db.as(superuser, sql, [
      actor,
      id,
      2,
      { ...values, agreement: { ...values.agreement, rebate_permission: true } },
    ]),
  ).rejects.toThrow();
  expect(
    (await db.as(superuser, "select name,revision from firms where id=$1", [id])).rows[0],
  ).toEqual({ name: "Updated", revision: 2 });
  expect(
    (await db.as(superuser, "select action from audit_log where entity_id=$1", [id])).rowCount,
  ).toBe(2);
});
