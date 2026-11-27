import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { service, setupTestDb, superuser, user } from "./support/db";

const db = setupTestDb();
const hash = (code: string) => createHash("sha256").update(code).digest("hex");

async function member() {
  const id = await db.createUser();
  await db.as(user(id), "select complete_onboarding('GB','Europe/London',true)");
  return id;
}

describe("telegram links", () => {
  it("links a chat with a one-time code, moves it on relink and stays private", async () => {
    const [a, b] = [await member(), await member()];
    await db.as(service, "select telegram_issue_code($1,$2)", [a, hash("alpha")]);
    // A wrong code and a reused code are both refused.
    await expect(
      db.as(service, "select telegram_link($1,42,'ann')", [hash("wrong")]),
    ).rejects.toThrow(/invalid or expired/);
    expect(
      (await db.as(service, "select telegram_link($1,42,'ann') u", [hash("alpha")])).rows[0]!.u,
    ).toBe(a);
    await expect(
      db.as(service, "select telegram_link($1,42,'ann')", [hash("alpha")]),
    ).rejects.toThrow(/invalid or expired/);
    expect((await db.as(user(a), "select chat_id::text from telegram_links")).rows).toEqual([
      { chat_id: "42" },
    ]);
    expect((await db.as(user(b), "select * from telegram_links")).rows).toEqual([]);
    // The same chat linked by another member moves to them.
    await db.as(service, "select telegram_issue_code($1,$2)", [b, hash("beta")]);
    await db.as(service, "select telegram_link($1,42,'bob')", [hash("beta")]);
    expect((await db.as(superuser, "select user_id from telegram_links")).rows).toEqual([
      { user_id: b },
    ]);
    await expect(
      db.as(user(a), "select telegram_issue_code($1,$2)", [a, hash("x")]),
    ).rejects.toThrow(/permission denied/);
  });

  it("expires codes after fifteen minutes", async () => {
    const a = await member();
    await db.as(service, "select telegram_issue_code($1,$2)", [a, hash("old")]);
    await db.as(
      superuser,
      "update private.telegram_link_codes set expires_at=now()-interval '1 second'",
    );
    await expect(db.as(service, "select telegram_link($1,7,null)", [hash("old")])).rejects.toThrow(
      /invalid or expired/,
    );
  });
});

describe("push subscriptions and dispatch", () => {
  it("keeps ten devices, reassigns endpoints and drops failing ones", async () => {
    const [a, b] = [await member(), await member()];
    const sub = (u: string, n: number) =>
      db.as(service, "select push_subscribe($1,$2,$3,$4)", [
        u,
        `https://push.example/${n}`,
        "p".repeat(40),
        "a".repeat(16),
      ]);
    for (let i = 0; i < 12; i++) await sub(a, i);
    expect(
      (await db.as(user(a), "select count(*)::int n from push_subscriptions")).rows[0]!.n,
    ).toBe(10);
    await sub(b, 11);
    expect((await db.as(user(b), "select endpoint from push_subscriptions")).rows).toEqual([
      { endpoint: "https://push.example/11" },
    ]);
    for (let i = 0; i < 5; i++)
      await db.as(service, "select push_failed($1,false)", ["https://push.example/11"]);
    expect((await db.as(user(b), "select * from push_subscriptions")).rows).toEqual([]);
    // Endpoint 11 moved to B, so A holds 9; a gone endpoint is removed at once.
    expect(
      (await db.as(user(a), "select count(*)::int n from push_subscriptions")).rows[0]!.n,
    ).toBe(9);
    await db.as(service, "select push_failed($1,true)", ["https://push.example/10"]);
    expect(
      (await db.as(user(a), "select count(*)::int n from push_subscriptions")).rows[0]!.n,
    ).toBe(8);
    await expect(
      db.as(service, "select push_subscribe($1,'http://insecure',$2,$3)", [
        a,
        "p".repeat(40),
        "a".repeat(16),
      ]),
    ).rejects.toThrow();
  });

  it("claims each new notification once and skips stale ones", async () => {
    const a = await member();
    await db.as(
      superuser,
      "insert into notifications(user_id,kind,event_key,detail) values($1,'coins_released','1','100'),($1,'coins_released','2','50')",
      [a],
    );
    await db.as(
      superuser,
      "insert into notifications(user_id,kind,event_key,detail,created_at) values($1,'coins_released','old','5',now()-interval '2 days')",
      [a],
    );
    const [x, y] = await Promise.all([
      db.as(service, "select * from claim_notification_batch(10)"),
      db.as(service, "select * from claim_notification_batch(10)"),
    ]);
    const details = [...x.rows, ...y.rows].map((r) => r.detail).sort();
    expect(details).toEqual(["100", "50"]);
    expect((await db.as(service, "select * from claim_notification_batch(10)")).rows).toEqual([]);
    expect(
      (
        await db.as(
          superuser,
          "select count(*)::int n from notifications where dispatched_at is null",
        )
      ).rows[0]!.n,
    ).toBe(0);
  });
});
