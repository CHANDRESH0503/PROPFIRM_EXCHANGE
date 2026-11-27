import { expect, it } from "vitest";
import { setupTestDb, service, superuser, user } from "./support/db";

const db = setupTestDb();

const save = (
  member: string,
  week: string,
  opts: { rule?: string | null; kept?: boolean | null } = {},
) =>
  db.as<{ xp: number }>(
    service,
    "select save_journal_review($1,$2::date,'Waited for the retest','Traded the open','Moved stop loss','partly',4::smallint,$3,$4) as xp",
    [member, week, opts.rule ?? null, opts.kept ?? null],
  );

it("reviews the week containing the latest review day, awards XP once and keeps reviews private", async () => {
  const member = await db.createUser();
  const other = await db.createUser();
  for (const id of [member, other])
    await db.as(user(id), "select complete_onboarding('GB','UTC',true)");

  // Default review day is Sunday. On Wednesday 2026-11-25 the open review is last week's
  // (Mon 16 – Sun 22 Nov); on Sunday 2026-11-29 it is this week's (Mon 23 Nov).
  const week = async (at: string) =>
    (
      await db.as<{ w: string }>(
        superuser,
        "select to_char(private.journal_review_week($1,$2::timestamptz),'YYYY-MM-DD') as w",
        [member, at],
      )
    ).rows[0]!.w;
  expect(await week("2026-11-25T12:00:00Z")).toBe("2026-11-16");
  expect(await week("2026-11-29T12:00:00Z")).toBe("2026-11-23");
  expect(await week("2026-11-30T00:30:00Z")).toBe("2026-11-23");
  // A Friday review day moves the window: on Wednesday the review is for last week.
  await db.as(service, "select set_journal_review_day($1,5::smallint)", [member]);
  expect(await week("2026-11-25T12:00:00Z")).toBe("2026-11-16");
  expect(await week("2026-11-27T12:00:00Z")).toBe("2026-11-23");
  await expect(
    db.as(service, "select set_journal_review_day($1,7::smallint)", [member]),
  ).rejects.toThrow(/0-6/);
  await db.as(service, "select set_journal_review_day($1,0::smallint)", [member]);
  // Members read their own review day but cannot write it directly.
  const { rows: own } = await db.as(user(member), "select journal_review_day from profiles");
  expect(own).toEqual([{ journal_review_day: 0 }]);
  await expect(
    db.as(user(member), "update profiles set journal_review_day=3 where id=$1", [member]),
  ).rejects.toThrow(/permission/);

  // Only the current review week can be saved.
  const current = (
    await db.as<{ w: string }>(
      service,
      "select to_char(journal_review_week($1),'YYYY-MM-DD') as w",
      [member],
    )
  ).rows[0]!.w;
  await expect(save(member, "2020-01-06")).rejects.toThrow(/current review week/);

  expect(
    (await save(member, current, { rule: "No trades in the first 15 minutes" })).rows[0]!.xp,
  ).toBe(100);
  // Editing the same week updates the answers and never awards again.
  expect((await save(member, current, { rule: "No trades before 08:15" })).rows[0]!.xp).toBe(0);
  const { rows: xp } = await db.as(
    service,
    "select coalesce(sum(amount),0)::int as n from xp_events where user_id=$1 and source='journal_review'",
    [member],
  );
  expect(xp[0]!.n).toBe(100);
  const { rows: stored } = await db.as(
    user(member),
    "select next_rule,previous_rule_kept from journal_reviews",
  );
  expect(stored).toEqual([{ next_rule: "No trades before 08:15", previous_rule_kept: null }]);

  // Without a rule from the previous week, "was it kept?" is not stored.
  expect(stored[0]!.previous_rule_kept).toBeNull();

  // Owner-only: another member sees nothing and cannot write directly.
  expect((await db.as(user(other), "select * from journal_reviews")).rows).toEqual([]);
  await expect(
    db.as(
      user(other),
      "insert into journal_reviews(user_id,week_start,followed_plan,feeling) values($1,$2,'yes',3)",
      [other, current],
    ),
  ).rejects.toThrow(/permission/);
  await expect(
    db.as(
      user(member),
      "select save_journal_review($1,$2::date,'','','','yes',3::smallint,null,null)",
      [member, current],
    ),
  ).rejects.toThrow(/permission/);
});

it("stores whether last week's rule was kept, and reminds active journalers once on review day", async () => {
  const member = await db.createUser();
  await db.as(user(member), "select complete_onboarding('GB','UTC',true)");
  const current = (
    await db.as<{ w: string }>(service, "select journal_review_week($1)::text as w", [member])
  ).rows[0]!.w;
  // Last week's review set a rule.
  await db.as(
    superuser,
    "insert into journal_reviews(user_id,week_start,followed_plan,feeling,next_rule) values($1,$2::date-7,'yes',3,'Stop after two losses')",
    [member, current],
  );
  await save(member, current, { kept: true });
  const { rows } = await db.as(
    user(member),
    "select previous_rule_kept from journal_reviews where week_start=$1",
    [current],
  );
  expect(rows[0]!.previous_rule_kept).toBe(true);

  // Reminders: Sunday 2026-11-29, 18:30 UTC for a UTC member who journaled recently.
  const other = await db.createUser();
  await db.as(user(other), "select complete_onboarding('GB','UTC',true)");
  await db.as(
    superuser,
    "insert into journal_trades(user_id,symbol,direction,closed_at,local_day,currency,result_cents) values($1,'EURUSD','long','2026-11-27T10:00:00Z','2026-11-27','USD',1000)",
    [other],
  );
  const remind = async (at: string) =>
    (
      await db.as<{ n: number }>(
        service,
        "select queue_journal_review_reminders($1::timestamptz) as n",
        [at],
      )
    ).rows[0]!.n;
  expect(await remind("2026-11-29T17:00:00Z")).toBe(0); // before 18:00
  expect(await remind("2026-11-28T18:30:00Z")).toBe(0); // not the review day
  expect(await remind("2026-11-29T18:30:00Z")).toBe(1);
  await remind("2026-11-29T19:30:00Z"); // a later run does not duplicate it
  const { rows: notes } = await db.as(
    service,
    "select kind,detail from notifications where user_id=$1",
    [other],
  );
  expect(notes).toEqual([{ kind: "journal_review", detail: "2026-11-23" }]);

  // Switched off in preferences: no reminder.
  await db.as(superuser, "delete from notifications where user_id=$1", [other]);
  await db.as(
    superuser,
    "insert into notification_prefs(user_id,journal_review) values($1,false) on conflict(user_id) do update set journal_review=false",
    [other],
  );
  await remind("2026-11-29T18:30:00Z");
  expect(
    (await db.as(service, "select count(*)::int as n from notifications where user_id=$1", [other]))
      .rows[0]!.n,
  ).toBe(0);
});
