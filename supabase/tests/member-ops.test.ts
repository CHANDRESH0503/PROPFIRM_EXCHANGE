import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { service, setupTestDb, superuser, user } from "./support/db";

const db = setupTestDb();

async function member() {
  const id = await db.createUser();
  await db.as(user(id), "select complete_onboarding('GB','Europe/London',true)");
  return id;
}
async function staff(role: string) {
  const id = await member();
  await db.as(superuser, "insert into admin_roles(user_id,role) values($1,$2)", [id, role]);
  return id;
}
const balance = async (u: string) =>
  Number(
    (
      await db.as(
        superuser,
        "select coalesce(available,0) a from wallet_balances where user_id=$1",
        [u],
      )
    ).rows[0]?.a ?? 0,
  );

async function budget(actor: string, cap = 1000) {
  return (
    await db.as<{ id: string }>(
      service,
      "select admin_save_budget($1,null,$2,'Payout-proof bonus',$3,null,null,true,'New campaign','req') id",
      [actor, `Campaign ${randomUUID().slice(0, 8)}`, cap],
    )
  ).rows[0]!.id;
}

describe("restrictions", () => {
  it("frozen members cannot create claims or redemptions; members see their status but not the reason", async () => {
    const [owner, m] = [await staff("owner"), await member()];
    await db.as(
      service,
      "select admin_set_restriction($1,$2,'frozen','Duplicate receipts under review','Your rewards are paused while we check a claim.','r1')",
      [owner, m],
    );
    // BEFORE triggers run before foreign-key checks, so placeholder references reach the guard.
    await expect(
      db.as(
        superuser,
        "insert into purchase_claims(user_id,program_id,firm_id,order_ref,amount_paid_cents,currency,expected_cents,purchased_on) values($1,$2,$2,'X',1,'USD',1,current_date)",
        [m, randomUUID()],
      ),
    ).rejects.toThrow(/frozen/);
    await expect(
      db.as(
        superuser,
        "insert into redemptions(wallet_id,reward_id,request_id,cost_coins,reward_name,instructions,status) values((select private.wallet_for($1)),$2,$2,1,'x','x','pending')",
        [m, randomUUID()],
      ),
    ).rejects.toThrow(/frozen/);
    expect(
      (await db.as(user(m), "select level, member_message from member_restrictions")).rows,
    ).toEqual([
      { level: "frozen", member_message: "Your rewards are paused while we check a claim." },
    ]);
    await expect(db.as(user(m), "select reason from member_restrictions")).rejects.toThrow(
      /permission denied/,
    );
    await db.as(service, "select admin_set_restriction($1,$2,null,'Review cleared','','r2')", [
      owner,
      m,
    ]);
    expect((await db.as(user(m), "select level from member_restrictions")).rows).toEqual([]);
    expect(
      (
        await db.as(
          superuser,
          "select count(*)::int n from audit_log where action='member.restriction'",
        )
      ).rows[0]!.n,
    ).toBe(2);
  });

  it("only the owner bans, and staff cannot restrict themselves", async () => {
    const [support, owner, m] = [await staff("support"), await staff("owner"), await member()];
    await expect(
      db.as(service, "select admin_set_restriction($1,$2,'banned','Fraud ring','','r')", [
        support,
        m,
      ]),
    ).rejects.toThrow(/permission/);
    await db.as(
      service,
      "select admin_set_restriction($1,$2,'suspended','Chargeback pattern','','r')",
      [support, m],
    );
    await db.as(
      service,
      "select admin_set_restriction($1,$2,'banned','Fraud ring confirmed','','r')",
      [owner, m],
    );
    await expect(
      db.as(service, "select admin_set_restriction($1,$1,'frozen','Testing','','r')", [owner]),
    ).rejects.toThrow(/themselves/);
  });
});

describe("campaign grants", () => {
  it("grants only from an open budget, within its cap, once per request", async () => {
    const [finance, m] = [await staff("finance"), await member()];
    const b = await budget(finance, 1000);
    const grant = (amount: number, req: string, confirmed = false) =>
      db.as(
        service,
        "select admin_grant_coins($1,$2,$3,$4,'Payout proof verified','Thanks for sharing your payout proof.',$5,$6) id",
        [finance, m, b, amount, confirmed, req],
      );
    await grant(600, "g1");
    await grant(600, "g1"); // retried request: no second credit
    expect(await balance(m)).toBe(600);
    await expect(grant(500, "g2")).rejects.toThrow(/cap reached/);
    await grant(400, "g3");
    expect(
      (
        await db.as(
          service,
          "select granted::int, remaining::int from campaign_budget_usage where id=$1",
          [b],
        )
      ).rows[0],
    ).toEqual({ granted: 1000, remaining: 0 });
    expect(
      (
        await db.as(
          superuser,
          "select kind, detail from notifications where user_id=$1 order by id",
          [m],
        )
      ).rows[0],
    ).toEqual({
      kind: "coins_adjusted",
      detail: "600|Thanks for sharing your payout proof.",
    });
    // Cap cannot drop below what is already granted.
    await expect(
      db.as(
        service,
        "select admin_save_budget($1,$2,'X campaign','Payout-proof bonus',900,null,null,true,'Lower cap','r')",
        [finance, b],
      ),
    ).rejects.toThrow(/cap below/);
  });

  it("needs confirmation for large grants and refuses closed budgets and other roles", async () => {
    const [finance, support, m] = [await staff("finance"), await staff("support"), await member()];
    const b = await budget(finance, 100000);
    await expect(
      db.as(service, "select admin_grant_coins($1,$2,$3,5000,'Large promotion','',false,'x1')", [
        finance,
        m,
        b,
      ]),
    ).rejects.toThrow(/confirmation/);
    await db.as(service, "select admin_grant_coins($1,$2,$3,5000,'Large promotion','',true,'x2')", [
      finance,
      m,
      b,
    ]);
    await expect(
      db.as(service, "select admin_grant_coins($1,$2,$3,10,'Not allowed','',false,'x3')", [
        support,
        m,
        b,
      ]),
    ).rejects.toThrow(/permission/);
    await db.as(
      service,
      "select admin_save_budget($1,$2,'Closed campaign','Payout-proof bonus',100000,null,null,false,'Close it','r')",
      [finance, b],
    );
    await expect(
      db.as(service, "select admin_grant_coins($1,$2,$3,10,'After close','',false,'x4')", [
        finance,
        m,
        b,
      ]),
    ).rejects.toThrow(/not open/);
  });

  it("removes only available Coins and writes new rows", async () => {
    const [finance, m] = [await staff("finance"), await member()];
    const b = await budget(finance, 1000);
    await db.as(service, "select admin_grant_coins($1,$2,$3,300,'Bonus','',false,'a1')", [
      finance,
      m,
      b,
    ]);
    await expect(
      db.as(service, "select admin_remove_coins($1,$2,301,'Correction','',false,'a2')", [
        finance,
        m,
      ]),
    ).rejects.toThrow(/available balance/);
    await db.as(service, "select admin_remove_coins($1,$2,100,'Duplicate bonus','',false,'a3')", [
      finance,
      m,
    ]);
    expect(await balance(m)).toBe(200);
    expect(
      (
        await db.as(
          superuser,
          "select type, amount from ledger_entries where wallet_id=(select id from wallet_accounts where user_id=$1) order by id",
          [m],
        )
      ).rows,
    ).toEqual([
      { type: "campaign_grant", amount: 300 },
      { type: "adjustment", amount: -100 },
    ]);
  });
});

describe("xp, boosters and notes", () => {
  it("adjusts XP once per request and keeps notes staff-only", async () => {
    const [support, m] = [await staff("support"), await member()];
    await db.as(service, "select admin_adjust_xp($1,$2,-40,'Farmed missions','x')", [support, m]);
    await db.as(service, "select admin_adjust_xp($1,$2,-40,'Farmed missions','x')", [support, m]);
    expect(
      (
        await db.as(
          superuser,
          "select sum(amount)::int s from xp_events where user_id=$1 and source='admin'",
          [m],
        )
      ).rows[0]!.s,
    ).toBe(-40);
    await db.as(service, "select admin_grant_booster($1,$2,'xp',2,24,'Apology for outage','b')", [
      support,
      m,
    ]);
    await expect(
      db.as(service, "select admin_grant_booster($1,$2,'giveback',900,null,'Too big','b2')", [
        support,
        m,
      ]),
    ).rejects.toThrow(/invalid booster/);
    await db.as(service, "select admin_add_note($1,$2,'Called about a missing claim')", [
      support,
      m,
    ]);
    await expect(db.as(user(m), "select * from member_notes")).rejects.toThrow(/permission denied/);
  });
});

describe("coin expiry", () => {
  it("warns at 30 and 7 days, then expires after 12 months of inactivity", async () => {
    const [finance, m] = [await staff("finance"), await member()];
    const b = await budget(finance, 1000);
    await db.as(service, "select admin_grant_coins($1,$2,$3,250,'Bonus','',false,'e1')", [
      finance,
      m,
      b,
    ]);
    // Make the member's last activity 11 months and 10 days ago.
    await db.as(
      superuser,
      "update auth.users set last_sign_in_at=now()-interval '11 months 10 days' where id=$1",
      [m],
    );
    await db.as(superuser, "update profiles set created_at=now()-interval '2 years' where id=$1", [
      m,
    ]);
    await db.as(superuser, "alter table ledger_entries disable trigger ledger_immutable");
    await db.as(
      superuser,
      "update ledger_entries set created_at=now()-interval '11 months 10 days'",
    );
    await db.as(superuser, "alter table ledger_entries enable trigger ledger_immutable");

    const run = (at: string) => db.as(service, "select * from process_coin_expiry($1)", [at]);
    await run(new Date().toISOString());
    await run(new Date().toISOString()); // same warning is not repeated
    const at = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
    await run(at(17)); // about a week before expiry
    expect(
      (
        await db.as(
          superuser,
          "select event_key from notifications where user_id=$1 and kind='coins_expiring' order by id",
          [m],
        )
      ).rows.map((r) => r.event_key.slice(0, 3)),
    ).toEqual(["w30", "w7:"]);
    expect((await run(at(30))).rows[0]).toEqual({ expired: 1, warned: 0 });
    expect(await balance(m)).toBe(0);
    expect((await run(at(31))).rows[0]).toEqual({ expired: 0, warned: 0 });
  });

  it("finds members by email, referral code and id for staff only", async () => {
    const [support, m] = [await staff("support"), await member()];
    const code = (await db.as(superuser, "select referral_code from profiles where id=$1", [m]))
      .rows[0]!.referral_code;
    expect(
      (await db.as(service, "select id from admin_find_members($1,$2,10)", [support, code])).rows,
    ).toEqual([{ id: m }]);
    expect(
      (await db.as(service, "select id from admin_find_members($1,$2,10)", [support, m])).rows,
    ).toEqual([{ id: m }]);
    await expect(
      db.as(service, "select * from admin_find_members($1,'x',10)", [m]),
    ).rejects.toThrow(/staff only/);
  });
});
