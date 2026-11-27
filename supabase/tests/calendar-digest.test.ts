import { expect, it } from "vitest";
import { setupTestDb, service, user } from "./support/db";

const db = setupTestDb();

it("selects members at their chosen local hour, once per local day, and validates settings", async () => {
  const member = await db.createUser();
  const other = await db.createUser();
  // America/New_York is UTC-05:00 in late November.
  await db.as(user(member), "select complete_onboarding('US','America/New_York',true)");
  await db.as(user(other), "select complete_onboarding('GB','UTC',true)");
  await db.as(service, "select set_calendar_digest($1,true,array['USD','EUR','USD'],7::smallint)", [
    member,
  ]);

  const due = async (at: string) =>
    (
      await db.as<{ user_id: string; local_day: string; currencies: string[] }>(
        service,
        "select user_id,local_day::text,currencies from due_calendar_digests($1::timestamptz)",
        [at],
      )
    ).rows;
  // 11:00 UTC = 06:00 New York: not yet.
  expect(await due("2026-11-23T11:00:00Z")).toEqual([]);
  // 12:00 UTC = 07:00 New York: due, currencies de-duplicated and sorted.
  expect(await due("2026-11-23T12:00:00Z")).toEqual([
    { user_id: member, local_day: "2026-11-23", currencies: ["EUR", "USD"] },
  ]);

  const mark = async (day: string) =>
    (
      await db.as<{ ok: boolean }>(service, "select mark_calendar_digest_sent($1,$2::date) as ok", [
        member,
        day,
      ])
    ).rows[0]!.ok;
  expect(await mark("2026-11-23")).toBe(true);
  // A second run the same day sends nothing.
  expect(await mark("2026-11-23")).toBe(false);
  expect(await due("2026-11-23T20:00:00Z")).toEqual([]);
  // The next local day it is due again.
  expect((await due("2026-11-24T12:30:00Z")).map((r) => r.local_day)).toEqual(["2026-11-24"]);

  // Paused digests are never due.
  await db.as(service, "select set_calendar_digest($1,false,array['USD'],7::smallint)", [member]);
  expect(await due("2026-11-25T12:30:00Z")).toEqual([]);

  // Settings are validated; members read their own row only and cannot write directly.
  await expect(
    db.as(service, "select set_calendar_digest($1,true,array['XXX'],7::smallint)", [member]),
  ).rejects.toThrow(/check/);
  await expect(
    db.as(service, "select set_calendar_digest($1,true,'{}'::text[],7::smallint)", [member]),
  ).rejects.toThrow();
  expect((await db.as(user(other), "select * from calendar_digests")).rows).toEqual([]);
  await expect(
    db.as(user(member), "update calendar_digests set active=true where user_id=$1", [member]),
  ).rejects.toThrow(/permission/);
});
