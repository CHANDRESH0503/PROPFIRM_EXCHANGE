import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { anon, service, setupTestDb, superuser, user } from "./support/db";

const db = setupTestDb();
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

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

/** A rejected claim for `owner`, reviewed by `reviewer` `daysAgo` days ago (inserted directly). */
async function rejectedClaim(owner: string, reviewer: string, daysAgo = 1) {
  const firm = (
    await db.as<{ id: string }>(
      superuser,
      "insert into firms(slug,name,asset_classes,is_sample) values($1,'Sample firm','{forex}',true) returning id",
      [`f-${randomUUID().slice(0, 8)}`],
    )
  ).rows[0]!.id;
  const program = (
    await db.as<{ id: string }>(
      superuser,
      "insert into firm_programs(firm_id,name,account_size,steps,list_price_cents,drawdown_type,payout_frequency) values($1,'50K',50000,2,10000,'static','monthly') returning id",
      [firm],
    )
  ).rows[0]!.id;
  return (
    await db.as<{ id: string }>(
      superuser,
      `insert into purchase_claims(user_id,program_id,firm_id,order_ref,amount_paid_cents,currency,expected_cents,purchased_on,status,reviewed_by,reviewed_at,checkout_email,receipt_path)
       values($1,$2,$3,$4,10000,'USD',10000,current_date,'rejected',$5,now()-make_interval(days=>$6),'a@example.com',$7) returning id`,
      [
        owner,
        program,
        firm,
        `ORD-${randomUUID().slice(0, 6)}`,
        reviewer,
        daysAgo,
        `${owner}/${randomUUID()}.png`,
      ],
    )
  ).rows[0]!.id;
}

describe("help centre", () => {
  it("shows only published articles to visitors and lets support edit them", async () => {
    const support = await staff("support");
    expect(
      (await db.as(anon, "select slug from help_articles where slug='how-claims-work'")).rows,
    ).toHaveLength(1);
    const draft = (
      await db.as<{ id: string }>(
        service,
        "select admin_save_article($1,null,'draft-one','account','Draft title','Short summary','Body text','draft','r') id",
        [support],
      )
    ).rows[0]!.id;
    expect((await db.as(anon, "select id from help_articles where id=$1", [draft])).rows).toEqual(
      [],
    );
    await db.as(
      service,
      "select admin_save_article($1,$2,'draft-one','account','Draft title','Short summary','Body text','published','r')",
      [support, draft],
    );
    expect(
      (await db.as(anon, "select id from help_articles where id=$1", [draft])).rows,
    ).toHaveLength(1);
    await expect(
      db.as(
        service,
        "select admin_save_article($1,null,'x-y','account','T title','S summary','B body','draft','r')",
        [await member()],
      ),
    ).rejects.toThrow(/role required/);
  });
});

describe("support tickets", () => {
  it("opens, replies both ways, hides internal notes and notifies the member", async () => {
    const [m, other, support] = [await member(), await member(), await staff("support")];
    const ticket = (
      await db.as<{ id: string }>(
        service,
        "select support_open($1,'coins','Coins missing','My Coins did not arrive',null,null) id",
        [m],
      )
    ).rows[0]!.id;
    expect((await db.as(user(m), "select priority, status from support_tickets")).rows).toEqual([
      { priority: "high", status: "open" },
    ]);
    await db.as(
      service,
      "select support_reply_staff($1,$2,'Checked: refund on file','true','open','r')",
      [support, ticket],
    );
    await db.as(
      service,
      "select support_reply_staff($1,$2,'We found it and fixed it.','false','waiting_on_user','r')",
      [support, ticket],
    );
    expect(
      (await db.as(user(m), "select body from support_messages order by id")).rows.map(
        (r) => r.body,
      ),
    ).toEqual(["My Coins did not arrive", "We found it and fixed it."]);
    expect((await db.as(user(other), "select * from support_messages")).rows).toEqual([]);
    expect(
      (await db.as(superuser, "select kind from notifications where user_id=$1", [m])).rows,
    ).toEqual([{ kind: "support_reply" }]);
    await db.as(service, "select support_reply_member($1,$2,'Thanks, confirmed.')", [m, ticket]);
    expect((await db.as(user(m), "select status from support_tickets")).rows).toEqual([
      { status: "open" },
    ]);
    await expect(
      db.as(service, "select support_reply_member($1,$2,'Not mine')", [other, ticket]),
    ).rejects.toThrow(/not found/);
    await expect(
      db.as(user(m), "select support_open($1,'other','Hi there','Body',null,null)", [m]),
    ).rejects.toThrow(/permission denied/);
  });

  it("refuses links to someone else's claim and caps open tickets", async () => {
    const [m, other, reviewer] = [await member(), await member(), await staff("finance")];
    const claim = await rejectedClaim(other, reviewer);
    await expect(
      db.as(service, "select support_open($1,'claim','About a claim','Body',$2,null)", [m, claim]),
    ).rejects.toThrow(/claim not found/);
    for (let i = 0; i < 5; i++)
      await db.as(service, "select support_open($1,'other','Question','Body',null,null)", [m]);
    await expect(
      db.as(service, "select support_open($1,'other','Question','Body',null,null)", [m]),
    ).rejects.toThrow(/too many/);
  });
});

describe("claim appeals", () => {
  it("allows one appeal within 14 days, decided by a different reviewer", async () => {
    const [m, first, second] = [await member(), await staff("finance"), await staff("support")];
    const claim = await rejectedClaim(m, first);
    const appeal = (
      await db.as<{ id: string }>(
        service,
        "select appeal_claim($1,$2,'Here is the order confirmation email with the reference.') id",
        [m, claim],
      )
    ).rows[0]!.id;
    await expect(
      db.as(service, "select appeal_claim($1,$2,'Trying a second time with more words.')", [
        m,
        claim,
      ]),
    ).rejects.toThrow(/already appealed/);
    await expect(
      db.as(service, "select decide_appeal($1,$2,true,'Looks fine now','r')", [first, appeal]),
    ).rejects.toThrow(/different reviewer/);
    await db.as(service, "select decide_appeal($1,$2,true,'Confirmation email matches','r')", [
      second,
      appeal,
    ]);
    expect(
      (await db.as(user(m), "select status from purchase_claims where id=$1", [claim])).rows,
    ).toEqual([{ status: "approved" }]);
    expect((await db.as(user(m), "select status from claim_appeals")).rows).toEqual([
      { status: "overturned" },
    ]);
    const late = await rejectedClaim(m, first, 20);
    await expect(
      db.as(service, "select appeal_claim($1,$2,'Too late but trying anyway with details.')", [
        m,
        late,
      ]),
    ).rejects.toThrow(/window closed/);
  });
});

describe("data requests", () => {
  it("confirms deletion by token, allows cancelling, then erases personal fields when due", async () => {
    const [m, reviewer] = [await member(), await staff("finance")];
    const claim = await rejectedClaim(m, reviewer);
    await db.as(service, "select request_deletion($1,$2)", [m, hash("t1")]);
    await expect(
      db.as(service, "select confirm_deletion($1,$2)", [m, hash("wrong")]),
    ).rejects.toThrow(/invalid or expired/);
    await db.as(service, "select confirm_deletion($1,$2)", [m, hash("t1")]);
    await db.as(service, "select cancel_deletion($1)", [m]);
    expect((await db.as(user(m), "select status from data_requests")).rows).toEqual([
      { status: "cancelled" },
    ]);

    await db.as(service, "select request_deletion($1,$2)", [m, hash("t2")]);
    await db.as(service, "select confirm_deletion($1,$2)", [m, hash("t2")]);
    expect((await db.as(service, "select * from due_deletions(10)")).rows).toEqual([]);
    await db.as(
      superuser,
      "update data_requests set due_at=now()-interval '1 minute' where status='confirmed'",
    );
    expect((await db.as(service, "select * from due_deletions(10)")).rows).toEqual([
      { user_id: m },
    ]);
    const files = await db.as(service, "select * from erase_member($1,null)", [m]);
    expect(files.rows.map((r) => r.bucket)).toEqual(["receipts"]);
    expect(
      (
        await db.as(
          superuser,
          "select checkout_email, receipt_path from purchase_claims where id=$1",
          [claim],
        )
      ).rows,
    ).toEqual([{ checkout_email: null, receipt_path: null }]);
    expect(
      (
        await db.as(
          superuser,
          "select status from data_requests where user_id=$1 and status='completed'",
          [m],
        )
      ).rows,
    ).toHaveLength(1);
    await expect(db.as(user(m), "select confirm_hash from data_requests")).rejects.toThrow(
      /permission denied/,
    );
  });
});
