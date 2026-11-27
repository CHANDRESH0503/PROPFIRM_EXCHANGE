import { expect, it } from "vitest";
import { setupTestDb, service, superuser, user } from "./support/db";

const db = setupTestDb();

type Row = { id: string; kind: string; external: boolean };
const claim = async (at: string) =>
  (
    await db.as<Row>(
      service,
      "select id::text,kind,external from claim_notification_batch(100,$1::timestamptz) order by id",
      [at],
    )
  ).rows;
const notify = (member: string, kind: string, key: string, at: string) =>
  db.as(
    superuser,
    "insert into notifications(user_id,kind,event_key,detail,created_at) values($1,$2,$3,'2026-11-23',$4::timestamptz)",
    [member, kind, key, at],
  );

it("holds external delivery during quiet hours, including windows that wrap midnight", async () => {
  const member = await db.createUser();
  // Asia/Kolkata is UTC+05:30. Quiet 22:00 → 07:00 local.
  await db.as(user(member), "select complete_onboarding('IN','Asia/Kolkata',true)");
  await db.as(
    service,
    "select set_inbox_preferences($1,true,true,true,true,22::smallint,7::smallint,null)",
    [member],
  );
  await notify(member, "claim_status", "q1", "2026-11-23T18:00:00Z");

  // 18:00 UTC = 23:30 local: inside the window, nothing is claimed.
  expect(await claim("2026-11-23T18:00:00Z")).toEqual([]);
  // 00:30 UTC = 06:00 local: still quiet.
  expect(await claim("2026-11-24T00:30:00Z")).toEqual([]);
  // 01:30 UTC = 07:00 local: the window has ended and it goes out.
  expect((await claim("2026-11-24T01:30:00Z")).map((r) => r.kind)).toEqual(["claim_status"]);

  // Invalid windows are refused.
  await expect(
    db.as(
      service,
      "select set_inbox_preferences($1,true,true,true,true,7::smallint,7::smallint,null)",
      [member],
    ),
  ).rejects.toThrow(/quiet_pair/);
  await expect(
    db.as(service, "select set_inbox_preferences($1,true,true,true,true,22::smallint,null,null)", [
      member,
    ]),
  ).rejects.toThrow(/quiet_pair/);
});

it("caps non-transactional messages per local day but never caps money updates", async () => {
  const member = await db.createUser();
  await db.as(user(member), "select complete_onboarding('GB','UTC',true)");
  await db.as(
    service,
    "select set_inbox_preferences($1,true,true,true,true,null,null,1::smallint)",
    [member],
  );
  const at = "2026-11-23T10:00:00Z";
  await notify(member, "journal_review", "r1", at);
  await notify(member, "draw_won", "d1", at);
  await notify(member, "coins_released", "c1", at);
  await notify(member, "claim_status", "c2", at);

  const first = await claim(at);
  expect(first.map((r) => [r.kind, r.external])).toEqual([
    ["journal_review", true],
    ["draw_won", false],
    ["coins_released", true],
    ["claim_status", true],
  ]);
  // Suppressed messages stay readable in the inbox.
  const { rows } = await db.as(user(member), "select count(*)::int as n from notifications");
  expect(rows[0]!.n).toBe(4);

  // A new local day resets the cap.
  await notify(member, "journal_review", "r2", "2026-11-24T09:00:00Z");
  expect((await claim("2026-11-24T09:00:00Z")).map((r) => r.external)).toEqual([true]);

  // Members cannot claim batches.
  await expect(
    db.as(user(member), "select * from claim_notification_batch(10,now())"),
  ).rejects.toThrow(/permission/);
});
