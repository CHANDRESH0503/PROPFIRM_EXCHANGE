import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { setupTestDb, service, superuser, user } from "./support/db";

const db = setupTestDb();

type Transition = { key: string; kind: string; transition: "opened" | "resolved" };
const sync = async () =>
  (await db.as<Transition>(service, "select key,kind,transition from sync_ops_alerts()")).rows;

it("opens and resolves each alert once, and keeps alerts private to the server", async () => {
  const member = await db.createUser();
  await db.as(user(member), "select complete_onboarding('GB','UTC',true)");
  const firm = randomUUID(),
    program = randomUUID(),
    reward = randomUUID();
  await db.as(
    superuser,
    "insert into firms(id,slug,name,asset_classes,published_at) values($1,'alerts','Alerts','{futures}',now())",
    [firm],
  );
  await db.as(
    superuser,
    "insert into firm_programs(id,firm_id,name,account_size,steps,list_price_cents,drawdown_type,payout_frequency,published_at) values($1,$2,'P',10000,1,15000,'static','monthly',now())",
    [program, firm],
  );

  // Nothing is wrong yet.
  expect(await sync()).toEqual([]);

  // An active voucher reward at its low-stock threshold (no codes, threshold 0) opens low_stock.
  await db.as(
    superuser,
    "insert into rewards(id,name,description,instructions,kind,program_id,cost_coins,low_stock,active) values($1,'Voucher','d','i','free_challenge_voucher',$2,100,0,true)",
    [reward, program],
  );
  // A claim waiting 25 hours opens claims_waiting.
  await db.as(
    superuser,
    "insert into purchase_claims(user_id,firm_id,program_id,order_ref,purchased_on,amount_paid_cents,expected_cents,currency,status,created_at) values($1,$2,$3,'OLD-1',current_date,15000,15000,'USD','submitted',now()-interval '25 hours')",
    [member, firm, program],
  );
  const opened = await sync();
  expect(opened.map((r) => [r.kind, r.transition]).sort()).toEqual([
    ["claims_waiting", "opened"],
    ["low_stock", "opened"],
  ]);
  expect(opened.find((r) => r.kind === "low_stock")?.key).toBe("low_stock:" + reward);

  // Still wrong a minute later: no repeat message.
  expect(await sync()).toEqual([]);

  // Deactivating the reward clears low_stock once; the claim is still waiting.
  await db.as(superuser, "update rewards set active=false where id=$1", [reward]);
  expect(await sync()).toEqual([
    { key: "low_stock:" + reward, kind: "low_stock", transition: "resolved" },
  ]);
  expect(await sync()).toEqual([]);

  // It reopens if the condition returns.
  await db.as(superuser, "update rewards set active=true where id=$1", [reward]);
  expect((await sync()).map((r) => r.transition)).toEqual(["opened"]);

  const { rows: open } = await db.as(
    service,
    "select kind from ops_alerts where active order by kind",
  );
  expect(open.map((r) => r.kind)).toEqual(["claims_waiting", "low_stock"]);

  // Members and anonymous callers can neither read alerts nor run the sync.
  await expect(db.as(user(member), "select * from ops_alerts")).rejects.toThrow(/permission/);
  await expect(db.as(user(member), "select * from sync_ops_alerts()")).rejects.toThrow(
    /permission/,
  );
});

it("opens a liability alert when outstanding Coins exceed confirmed commission", async () => {
  const conditions = async () =>
    (await db.as<{ kind: string }>(service, "select kind from ops_alert_conditions()")).rows.map(
      (r) => r.kind,
    );
  expect(await conditions()).not.toContain("liability");
  const member = await db.createUser();
  await db.as(user(member), "select complete_onboarding('GB','UTC',true)");
  const { rows } = await db.as(
    superuser,
    "insert into wallet_accounts(user_id) values($1) returning id",
    [member],
  );
  // A commission of 1,000 cents backs 900 Coins; 1,200 outstanding Coins push the ratio above 1.
  const firm = randomUUID();
  await db.as(
    superuser,
    "insert into firms(id,slug,name,asset_classes) values($1,'liab','Liab','{futures}')",
    [firm],
  );
  await db.as(
    superuser,
    "insert into commissions(firm_id,external_ref,order_ref,amount_cents,status) values($1,'X1','O1',1000,'confirmed')",
    [firm],
  );
  await db.as(
    superuser,
    "insert into ledger_entries(wallet_id,amount,bucket,type,ref_type,ref_id,idempotency_key,config_version) values($1,1200,'available','adjustment','test',gen_random_uuid(),'liab-test',(select max(version) from economy_config))",
    [rows[0]!.id],
  );
  expect(await conditions()).toContain("liability");
});
