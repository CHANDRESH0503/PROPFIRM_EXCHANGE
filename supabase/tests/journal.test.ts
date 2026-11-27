import { describe, expect, it } from "vitest";
import { service, setupTestDb, superuser, user } from "./support/db";

const db = setupTestDb();

async function member(zone = "Europe/London") {
  const id = await db.createUser();
  await db.as(user(id), "select complete_onboarding('GB',$1,true)", [zone]);
  return id;
}

type Trade = {
  closed?: string;
  result?: number;
  tags?: string[];
  notes?: string | null;
  strategy?: string | null;
  followed?: string[];
  broken?: string[];
  currency?: string;
  r?: number | null;
};

function save(id: string, t: Trade = {}, tradeId: string | null = null) {
  return db.as<{ id: string }>(
    service,
    `select journal_save_trade($1,$2,'manual','EURUSD','long',null,$3,1,1.1,1.101,1.099,null,$4,$5,-700,0,10,$6,'london',
      $7,null,null,null,$8,$9::uuid[],$10::uuid[],$11::uuid[]) as id`,
    [
      id,
      tradeId,
      t.closed ?? new Date(Date.now() - 3_600_000).toISOString(),
      t.currency ?? "USD",
      t.result ?? 10_000,
      t.r ?? 1,
      t.strategy ?? null,
      t.notes ?? null,
      t.tags ?? [],
      t.followed ?? [],
      t.broken ?? [],
    ],
  );
}

const tag = async (kind: string, name: string) =>
  (
    await db.as<{ id: string }>(
      superuser,
      "select id from journal_tags where user_id is null and kind=$1 and name=$2",
      [kind, name],
    )
  ).rows[0]!.id;

describe("journal", () => {
  it("keeps journals private to their owner and closed to direct writes", async () => {
    const [a, b] = [await member(), await member()];
    const trade = (await save(a)).rows[0]!.id;
    expect((await db.as(user(a), "select id from journal_trades")).rows).toEqual([{ id: trade }]);
    expect((await db.as(user(b), "select id from journal_trades")).rows).toEqual([]);
    expect((await db.as(user(b), "select * from journal_daily_stats")).rows).toEqual([]);
    await expect(
      db.as(
        user(a),
        "insert into journal_trades(user_id,symbol,direction,closed_at,local_day,currency,result_cents) values($1,'EURUSD','long',now(),current_date,'USD',1)",
        [a],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(db.as(user(a), "select journal_no_trades($1)", [a])).rejects.toThrow(
      /permission denied/,
    );
    // Another member cannot edit or delete the trade through the functions either.
    await expect(save(b, {}, trade)).rejects.toThrow(/trade not found/);
    await expect(db.as(service, "select journal_delete_trade($1,$2)", [b, trade])).rejects.toThrow(
      /trade not found/,
    );
  });

  it("maintains daily stats on insert, edit and delete, per currency", async () => {
    const a = await member("America/New_York");
    // 03:30 UTC on 20 November is still 19 November in New York.
    const one = (await save(a, { closed: "2026-11-20T03:30:00Z", result: 10_000, r: 2 })).rows[0]!
      .id;
    await save(a, { closed: "2026-11-19T15:00:00Z", result: -5_000, r: -1 });
    await save(a, { closed: "2026-11-19T16:00:00Z", result: 2_000, currency: "EUR" });
    const stats = () =>
      db.as(
        superuser,
        "select local_day::text,currency,trades,wins,losses,net_cents::int,r_sum::float,best_cents::int,worst_cents::int from journal_daily_stats where user_id=$1 order by currency",
        [a],
      );
    // Net includes the -700 commission on every trade.
    expect((await stats()).rows).toEqual([
      {
        local_day: "2026-11-19",
        currency: "EUR",
        trades: 1,
        wins: 1,
        losses: 0,
        net_cents: 1300,
        r_sum: 1,
        best_cents: 1300,
        worst_cents: 1300,
      },
      {
        local_day: "2026-11-19",
        currency: "USD",
        trades: 2,
        wins: 1,
        losses: 1,
        net_cents: 9300 - 5700,
        r_sum: 1,
        best_cents: 9300,
        worst_cents: -5700,
      },
    ]);
    await save(a, { closed: "2026-11-21T12:00:00Z", result: 10_000, r: 2 }, one);
    expect((await stats()).rows.map((r) => [r.local_day, r.currency, r.trades])).toEqual([
      ["2026-11-19", "EUR", 1],
      ["2026-11-19", "USD", 1],
      ["2026-11-21", "USD", 1],
    ]);
    await db.as(service, "select journal_delete_trade($1,$2)", [a, one]);
    expect((await stats()).rows).toHaveLength(2);
  });

  it("awards XP only for tagged or noted trades, at most ten a day, and starts the streak", async () => {
    const a = await member();
    const mistake = await tag("mistake", "Revenge trade");
    await save(a);
    expect(
      (
        await db.as(
          superuser,
          "select count(*)::int n from xp_events where user_id=$1 and source='journal_trade'",
          [a],
        )
      ).rows[0]!.n,
    ).toBe(0);
    for (let i = 0; i < 12; i++) await save(a, { tags: [mistake] });
    const xp = await db.as(
      superuser,
      "select count(*)::int n, sum(amount)::int total from xp_events where user_id=$1 and source='journal_trade'",
      [a],
    );
    expect(xp.rows[0]).toEqual({ n: 10, total: 50 });
    expect(
      (await db.as(superuser, "select current_streak from journal_streaks where user_id=$1", [a]))
        .rows,
    ).toEqual([{ current_streak: 1 }]);
    expect(
      (
        await db.as(
          superuser,
          "select mission from mission_progress where user_id=$1 and mission='journal_first'",
          [a],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.as(
          superuser,
          "select badge from user_badges where user_id=$1 and badge='journal_first'",
          [a],
        )
      ).rows,
    ).toHaveLength(1);
    // No Coins are ever minted by the journal.
    expect((await db.as(superuser, "select count(*)::int n from ledger_entries")).rows[0]!.n).toBe(
      0,
    );
  });

  it("rejects tags and rules that belong to someone else", async () => {
    const [a, b] = [await member(), await member()];
    const own = (
      await db.as<{ id: string }>(
        service,
        "select journal_create_tag($1,'setup','London breakout') id",
        [b],
      )
    ).rows[0]!.id;
    await expect(save(a, { tags: [own] })).rejects.toThrow(/unknown tag/);
    const strategy = (
      await db.as<{ id: string }>(
        service,
        "select journal_save_strategy($1,null,'Breakout','',array['Wait for close','Risk 1%']) id",
        [b],
      )
    ).rows[0]!.id;
    const rules = (
      await db.as<{ id: string }>(
        superuser,
        "select id from journal_strategy_rules where strategy_id=$1 order by position",
        [strategy],
      )
    ).rows.map((r) => r.id);
    await expect(save(a, { strategy, followed: rules })).rejects.toThrow();
    const saved = (await save(b, { strategy, followed: [rules[0]!], broken: [rules[1]!] })).rows[0]!
      .id;
    expect(
      (
        await db.as(
          user(b),
          "select followed from journal_trade_rule_checks where trade_id=$1 order by followed",
          [saved],
        )
      ).rows,
    ).toEqual([{ followed: false }, { followed: true }]);
    // Editing rules keeps positions, so earlier checks stay linked; dropping a rule removes its checks.
    await db.as(
      service,
      "select journal_save_strategy($1,$2,'Breakout','',array['Wait for candle close'])",
      [b, strategy],
    );
    expect(
      (
        await db.as(
          user(b),
          "select count(*)::int n from journal_trade_rule_checks where trade_id=$1",
          [saved],
        )
      ).rows[0]!.n,
    ).toBe(1);
  });

  it("moves the journal streak with one free freeze a week", async () => {
    const a = await member("UTC");
    const mark = (at: string) =>
      db.as(superuser, "select private.journal_mark_day($1,'no_trades',$2)", [a, at]);
    const streak = async () =>
      (
        await db.as(
          superuser,
          "select current_streak,longest from journal_streaks where user_id=$1",
          [a],
        )
      ).rows[0];
    await mark("2026-11-16T10:00:00Z"); // Monday
    await mark("2026-11-17T10:00:00Z");
    await mark("2026-11-19T10:00:00Z"); // missed Wednesday: weekly freeze
    expect(await streak()).toEqual({ current_streak: 3, longest: 3 });
    await mark("2026-11-21T10:00:00Z"); // missed Friday, same week: freeze used
    expect(await streak()).toEqual({ current_streak: 1, longest: 3 });
    await mark("2026-11-21T20:00:00Z"); // same day twice
    expect(await streak()).toEqual({ current_streak: 1, longest: 3 });
  });

  it("limits screenshots to four per trade inside the member's folder", async () => {
    const a = await member();
    const trade = (await save(a)).rows[0]!.id;
    const path = () => `${a}/${trade}/${crypto.randomUUID()}.webp`;
    for (let i = 0; i < 4; i++)
      await db.as(service, "select journal_add_screenshot($1,$2,$3,1000)", [a, trade, path()]);
    await expect(
      db.as(service, "select journal_add_screenshot($1,$2,$3,1000)", [a, trade, path()]),
    ).rejects.toThrow(/screenshot limit/);
    const other = await member();
    await expect(
      db.as(service, "select journal_add_screenshot($1,$2,$3,1000)", [
        other,
        trade,
        `${other}/${trade}/${crypto.randomUUID()}.webp`,
      ]),
    ).rejects.toThrow(/trade not found/);
    const removed = await db.as<{ p: string }>(service, "select journal_delete_trade($1,$2) p", [
      a,
      trade,
    ]);
    expect(removed.rows).toHaveLength(4);
    expect(
      (await db.as(superuser, "select count(*)::int n from journal_screenshots")).rows[0]!.n,
    ).toBe(0);
  });

  it("refuses a close time in the future", async () => {
    const a = await member();
    await expect(
      save(a, { closed: new Date(Date.now() + 86_400_000).toISOString() }),
    ).rejects.toThrow(/future/);
  });
});
