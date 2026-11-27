import { describe, expect, it } from "vitest";
import { anon, service, setupTestDb, superuser, user } from "./support/db";

const db = setupTestDb();

async function member(country = "GB") {
  const id = await db.createUser();
  await db.as(user(id), "select complete_onboarding($1,'Europe/London',true)", [country]);
  return id;
}
const flag = (key: string, on: boolean, excluded: string[] = []) =>
  db.as(
    superuser,
    "update feature_flags set enabled=$2, excluded_countries=$3::char(2)[] where key=$1",
    [key, on, excluded],
  );

describe("spin", () => {
  it("is off by default and respects region exclusions", async () => {
    const m = await member("GB");
    expect(
      (
        await db.as(
          superuser,
          "select enabled from feature_flags where key in ('spins','draws') order by key",
        )
      ).rows,
    ).toEqual([{ enabled: false }, { enabled: false }]);
    await expect(db.as(service, "select * from spin($1,'GB')", [m])).rejects.toThrow(
      /not available/,
    );
    await flag("spins", true, ["IN"]);
    await expect(db.as(service, "select * from spin($1,'IN')", [m])).rejects.toThrow(
      /not available/,
    );
    const inMember = await member("IN");
    await expect(db.as(service, "select * from spin($1,'GB')", [inMember])).rejects.toThrow(
      /not available/,
    );
    await flag("spins", false);
  });

  it("spins once a day, records the random value, and never mints Coins", async () => {
    const m = await member();
    await flag("spins", true);
    const r = await db.as(service, "select * from spin($1,'GB')", [m]);
    expect(r.rows).toHaveLength(1);
    expect(["xp", "xp_boost", "freeze", "ticket"]).toContain(r.rows[0]!.kind);
    await expect(db.as(service, "select * from spin($1,'GB')", [m])).rejects.toThrow(
      /already spun/,
    );
    const saved = (await db.as(user(m), "select rng, kind from spins")).rows;
    expect(saved).toHaveLength(1);
    expect(saved[0]!.rng).toMatch(/^[0-9a-f]{12}$/);
    expect((await db.as(superuser, "select count(*)::int n from ledger_entries")).rows[0]!.n).toBe(
      0,
    );
    await flag("spins", false);
  });

  it("publishes odds that add up to 100% and only the owner can change them", async () => {
    const odds = await db.as(anon, "select sum(odds_ppm)::int total from spin_prizes");
    expect(odds.rows[0]!.total).toBe(1_000_000);
    const owner = await member();
    await db.as(superuser, "insert into admin_roles(user_id,role) values($1,'owner')", [owner]);
    await expect(
      db.as(service, "select admin_save_spin_prizes($1,$2::jsonb,'Rebalance','r')", [
        owner,
        JSON.stringify([{ label: "10 XP", kind: "xp", value: 10, odds_ppm: 900000 }]),
      ]),
    ).rejects.toThrow(/add up to 100/);
    await db.as(service, "select admin_save_spin_prizes($1,$2::jsonb,'Only XP for now','r')", [
      owner,
      JSON.stringify([{ label: "15 XP", kind: "xp", value: 15, odds_ppm: 1000000 }]),
    ]);
    await flag("spins", true);
    const m = await member();
    expect(
      (await db.as(service, "select label, kind, value from spin($1,'GB')", [m])).rows,
    ).toEqual([{ label: "15 XP", kind: "xp", value: 15 }]);
    expect(
      (
        await db.as(superuser, "select amount from xp_events where user_id=$1 and source='spin'", [
          m,
        ])
      ).rows,
    ).toEqual([{ amount: 15 }]);
    await flag("spins", false);
  });

  it("draws uniformly over the configured range", async () => {
    // 2,000 draws in [0, 4): every bucket is hit, none wildly over-represented.
    const rows = (
      await db.as(
        superuser,
        "select (private.secure_random(4)).value::int v from generate_series(1,2000)",
      )
    ).rows;
    const counts = [0, 1, 2, 3].map((b) => rows.filter((r) => r.v === b).length);
    expect(Math.min(...counts)).toBeGreaterThan(380);
    expect(Math.max(...counts)).toBeLessThan(620);
  });
});

describe("draw", () => {
  it("takes free entries once, picks a winner after the end, and publishes only a label", async () => {
    const [owner, a, b] = [await member(), await member(), await member()];
    await db.as(superuser, "insert into admin_roles(user_id,role) values($1,'owner')", [owner]);
    await flag("draws", true);
    const draw = (
      await db.as<{ id: string }>(
        service,
        "select admin_save_draw($1,null,'Weekly draw','One 50K challenge voucher donated by a sample firm',now()-interval '1 hour',now()+interval '1 hour',5,false,'r') id",
        [owner],
      )
    ).rows[0]!.id;
    expect((await db.as(service, "select enter_draw($1,$2,'GB') t", [a, draw])).rows[0]!.t).toBe(1);
    expect((await db.as(service, "select enter_draw($1,$2,'GB') t", [a, draw])).rows[0]!.t).toBe(1);
    await db.as(service, "select enter_draw($1,$2,'GB')", [b, draw]);
    await expect(db.as(service, "select run_draw($1,$2,'r')", [owner, draw])).rejects.toThrow(
      /not ended/,
    );
    await db.as(superuser, "update draws set ends_at=now()-interval '1 second' where id=$1", [
      draw,
    ]);
    await expect(db.as(service, "select run_draw($1,$2,'r')", [a, draw])).rejects.toThrow(
      /owner only/,
    );
    const winner = (await db.as(service, "select run_draw($1,$2,'r') w", [owner, draw])).rows[0]!.w;
    expect([a, b]).toContain(winner);
    expect(
      (
        await db.as(anon, "select status, tickets_total, winner_label from draws where id=$1", [
          draw,
        ])
      ).rows[0],
    ).toMatchObject({
      status: "drawn",
      tickets_total: 2,
    });
    await expect(db.as(anon, "select winner_user from draws")).rejects.toThrow(/permission denied/);
    expect(
      (await db.as(superuser, "select kind from notifications where user_id=$1", [winner])).rows,
    ).toEqual([{ kind: "draw_won" }]);
    await expect(db.as(service, "select run_draw($1,$2,'r')", [owner, draw])).rejects.toThrow(
      /not open/,
    );
    await flag("draws", false);
  });
});
