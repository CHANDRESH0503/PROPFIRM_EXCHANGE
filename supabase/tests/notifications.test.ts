import { expect, it } from "vitest";
import { setupTestDb, service, user, superuser, pgError } from "./support/db";

const db = setupTestDb();

it("delivers committed releases once, enforces inbox ownership and honors preferences", async () => {
  const buyer = await db.createUser();
  const other = await db.createUser();
  const release = (key: string) =>
    db.as(
      superuser,
      "insert into ledger_entries(wallet_id,amount,bucket,type,ref_type,ref_id,idempotency_key,config_version) values(private.wallet_for($1),50,'available','release','commission',gen_random_uuid(),$2,1) on conflict(idempotency_key) do nothing",
      [buyer, key],
    );
  const inbox = (id: string) => db.as(user(id), "select id,detail,read_at from notifications");
  await Promise.all([release("release:first"), release("release:first")]);
  const { rows } = await inbox(buyer);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ detail: "50", read_at: null });
  expect((await inbox(other)).rows).toEqual([]);
  await db.as(service, "select read_inbox_item($1,$2)", [other, rows[0]!.id]);
  expect((await inbox(buyer)).rows[0]!.read_at).toBeNull();
  await db.as(service, "select read_inbox_item($1,$2)", [buyer, rows[0]!.id]);
  expect((await inbox(buyer)).rows[0]!.read_at).toBeTruthy();
  expect((await pgError(db.as(user(other), "delete from notifications"))).code).toBe("42501");
  await db.as(service, "select set_inbox_preferences($1,true,true,false)", [buyer]);
  await release("release:second");
  expect((await inbox(buyer)).rows).toHaveLength(1);
  expect((await db.as(user(other), "select * from notification_prefs")).rows).toEqual([]);
});
