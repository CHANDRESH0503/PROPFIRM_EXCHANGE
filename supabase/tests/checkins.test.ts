import { expect, it } from "vitest";
import { setupTestDb, superuser, user } from "./support/db";
const db = setupTestDb();
it("uses local midnight across daylight saving time and serializes repeat check-ins", async () => {
  const id = await db.createUser();
  await db.as(user(id), "select complete_onboarding('US','America/New_York',true)");
  const visit = (utc: string) =>
    db.as(
      superuser,
      "select local_day::text,streak,awarded_xp,freezes_used from private.check_in_at($1,$2)",
      [id, utc],
    );
  const before = await visit("2026-03-08T04:59:59Z");
  expect(before.rows[0]!.local_day).toBe("2026-03-07");
  const [a, b] = await Promise.all([visit("2026-03-08T05:00:00Z"), visit("2026-03-09T03:59:59Z")]);
  expect(a.rows).toEqual(b.rows);
  expect((await visit("2026-03-09T04:00:00Z")).rows[0]).toMatchObject({
    local_day: "2026-03-09",
    streak: 3,
  });
  expect((await visit("2026-03-11T12:00:00Z")).rows[0]).toMatchObject({
    streak: 4,
    freezes_used: 1,
  });
  expect(
    (await db.as(superuser, "select count(*)::int n from xp_events where source='checkin'"))
      .rows[0]!.n,
  ).toBe(4);
  expect((await db.as(superuser, "select count(*)::int n from ledger_entries")).rows[0]!.n).toBe(0);
});
