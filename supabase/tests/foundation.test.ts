import { describe, expect, it } from "vitest";
import { anon, pgError, service, superuser, setupTestDb, user } from "./support/db";

const db = setupTestDb();

async function makeOwner(): Promise<string> {
  const id = await db.createUser();
  await db.as(superuser, "insert into public.admin_roles (user_id, role) values ($1, 'owner')", [id]);
  return id;
}

describe("profiles", () => {
  it("creates a profile with a referral code when an auth user is created", async () => {
    const id = await db.createUser();
    const { rows } = await db.as(user(id), "select id, referral_code, onboarded_at from public.profiles");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, onboarded_at: null });
    expect(rows[0]!.referral_code).toMatch(/^[A-Z2-9]{8}$/);
  });

  it("records a valid referral code from sign-up metadata, and ignores an unknown one", async () => {
    const referrer = await db.createUser();
    const { rows } = await db.as(superuser, "select referral_code from public.profiles where id = $1", [referrer]);
    const friend = await db.createUser({ ref: rows[0]!.referral_code.toLowerCase() });
    const stranger = await db.createUser({ ref: "NOTACODE" });
    const result = await db.as(superuser, "select id, referred_by from public.profiles where id = any($1)", [
      [friend, stranger],
    ]);
    const byId = Object.fromEntries(result.rows.map((r) => [r.id, r.referred_by]));
    expect(byId[friend]).toBe(referrer);
    expect(byId[stranger]).toBeNull();
  });

  it("lets a user read only their own profile", async () => {
    const a = await db.createUser();
    const b = await db.createUser();
    const { rows } = await db.as(user(a), "select id from public.profiles");
    expect(rows.map((r) => r.id)).toEqual([a]);
    expect((await db.as(user(b), "select id from public.profiles where id = $1", [a])).rows).toEqual([]);
    expect((await db.as(anon, "select id from public.profiles").catch((e) => e)).code).toBe("42501");
  });

  it("hides fraud and internal columns from the user", async () => {
    const a = await db.createUser();
    expect((await pgError(db.as(user(a), "select risk_score from public.profiles"))).code).toBe("42501");
    expect((await pgError(db.as(user(a), "select referred_by from public.profiles"))).code).toBe("42501");
  });

  it("lets a user change their display name but nothing else", async () => {
    const a = await db.createUser();
    const b = await db.createUser();
    await db.as(user(a), "update public.profiles set display_name = 'Trader A' where id = $1", [a]);
    expect((await db.as(superuser, "select display_name from public.profiles where id = $1", [a])).rows[0]).toEqual({
      display_name: "Trader A",
    });

    for (const column of ["risk_score = 0", "country_code = 'US'", "onboarded_at = now()", "referral_code = 'AAAAAAAA'"]) {
      expect((await pgError(db.as(user(a), `update public.profiles set ${column} where id = $1`, [a]))).code).toBe("42501");
    }
    // Another user's row is invisible to the update, so nothing changes.
    const res = await db.as(user(a), "update public.profiles set display_name = 'Hacked' where id = $1", [b]);
    expect(res.rowCount).toBe(0);
  });

  it("does not let users insert or delete profiles", async () => {
    const a = await db.createUser();
    expect((await pgError(db.as(user(a), "delete from public.profiles where id = $1", [a]))).code).toBe("42501");
    expect(
      (await pgError(db.as(user(a), "insert into public.profiles (id, referral_code) values (gen_random_uuid(), 'ABCDEFGH')"))).code,
    ).toBe("42501");
  });
});

describe("complete_onboarding", () => {
  it("sets country, timezone and the 18+ confirmation once", async () => {
    const a = await db.createUser();
    await db.as(user(a), "select public.complete_onboarding('GB', 'Europe/London', true)");
    const { rows } = await db.as(user(a), "select country_code, timezone, age_confirmed_at, onboarded_at from public.profiles");
    expect(rows[0]).toMatchObject({ country_code: "GB", timezone: "Europe/London" });
    expect(rows[0]!.age_confirmed_at).not.toBeNull();
    expect(rows[0]!.onboarded_at).not.toBeNull();

    // Country cannot be changed later through onboarding (it would bypass geo rules).
    const again = await pgError(db.as(user(a), "select public.complete_onboarding('US', 'America/New_York', true)"));
    expect(again.message).toContain("already_onboarded");
  });

  it.each([
    ["GB", "Europe/London", false, "age_confirmation_required"],
    ["gb", "Europe/London", true, "invalid_country"],
    ["GB", "Mars/Olympus", true, "invalid_timezone"],
  ])("rejects country=%s timezone=%s adult=%s", async (country, tz, adult, message) => {
    const a = await db.createUser();
    const error = await pgError(db.as(user(a), "select public.complete_onboarding($1, $2, $3)", [country, tz, adult]));
    expect(error.message).toContain(message);
  });

  it("cannot be called by anon", async () => {
    const error = await pgError(db.as(anon, "select public.complete_onboarding('GB', 'Europe/London', true)"));
    expect(error.code).toBe("42501");
  });
});

describe("admin roles", () => {
  it("lets a user see only their own roles, and the owner see all", async () => {
    const owner = await makeOwner();
    const staff = await db.createUser();
    await db.as(service, "select public.admin_set_role($1, $2, 'support', true, 'new support hire')", [owner, staff]);

    expect((await db.as(user(staff), "select role from public.admin_roles")).rows).toEqual([{ role: "support" }]);
    expect((await db.as(user(owner), "select user_id from public.admin_roles")).rowCount).toBe(2);
    const outsider = await db.createUser();
    expect((await db.as(user(outsider), "select * from public.admin_roles")).rows).toEqual([]);
  });

  it("refuses role changes from a non-owner, without a reason, or removing one's own owner role", async () => {
    const owner = await makeOwner();
    const staff = await db.createUser();
    await db.as(service, "select public.admin_set_role($1, $2, 'support', true, 'new support hire')", [owner, staff]);

    expect(
      (await pgError(db.as(service, "select public.admin_set_role($1, $1, 'owner', true, 'promote myself')", [staff]))).message,
    ).toContain("forbidden");
    expect(
      (await pgError(db.as(service, "select public.admin_set_role($1, $2, 'finance', true, '')", [owner, staff]))).message,
    ).toContain("reason_required");
    expect(
      (await pgError(db.as(service, "select public.admin_set_role($1, $1, 'owner', false, 'step down')", [owner]))).message,
    ).toContain("cannot_remove_own_owner_role");
  });

  it("cannot be granted by a signed-in user directly", async () => {
    const a = await db.createUser();
    expect(
      (await pgError(db.as(user(a), "insert into public.admin_roles (user_id, role) values ($1, 'owner')", [a]))).code,
    ).toBe("42501");
    expect(
      (await pgError(db.as(user(a), "select public.admin_set_role($1, $1, 'owner', true, 'please')", [a]))).code,
    ).toBe("42501");
  });

  it("bootstraps the first owner from the CLI only", async () => {
    const email = `owner-${Date.now()}@example.test`;
    const id = await db.createUser({ email });
    expect((await pgError(db.as(service, "select private.bootstrap_owner($1)", [email]))).code).toBe("42501");
    await db.as(superuser, "select private.bootstrap_owner($1)", [email]);
    expect((await db.as(user(id), "select role from public.admin_roles where user_id = $1", [id])).rows).toEqual([
      { role: "owner" },
    ]);
  });
});

describe("feature flags", () => {
  it("ships chance-based features switched off", async () => {
    const { rows } = await db.as(anon, "select key, enabled from public.feature_flags where key in ('spins', 'draws') order by key");
    expect(rows).toEqual([
      { key: "draws", enabled: false },
      { key: "spins", enabled: false },
    ]);
  });

  it("is read-only to clients", async () => {
    const a = await db.createUser();
    expect((await pgError(db.as(anon, "update public.feature_flags set enabled = true"))).code).toBe("42501");
    expect((await pgError(db.as(user(a), "update public.feature_flags set enabled = true"))).code).toBe("42501");
  });

  it("changes only through the owner function, which writes the audit log", async () => {
    const owner = await makeOwner();
    await db.as(service, "select public.admin_set_feature_flag($1, 'maintenance_mode', true, 'database upgrade', 'req-1')", [owner]);

    const flag = await db.as(anon, "select enabled from public.feature_flags where key = 'maintenance_mode'");
    expect(flag.rows[0]).toEqual({ enabled: true });

    const audit = await db.as(user(owner), "select actor_id, action, entity_id, before, after, reason, request_id from public.audit_log where request_id = 'req-1'",
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({
      actor_id: owner,
      action: "feature_flag.update",
      entity_id: "maintenance_mode",
      reason: "database upgrade",
      request_id: "req-1",
    });
    expect(audit.rows[0]!.before.enabled).toBe(false);
    expect(audit.rows[0]!.after.enabled).toBe(true);
  });

  it("refuses non-owners and unknown flags", async () => {
    const owner = await makeOwner();
    const staff = await db.createUser();
    await db.as(service, "select public.admin_set_role($1, $2, 'content', true, 'content editor')", [owner, staff]);
    expect(
      (await pgError(db.as(service, "select public.admin_set_feature_flag($1, 'spins', true, 'turn it on')", [staff]))).message,
    ).toContain("forbidden");
    expect(
      (await pgError(db.as(service, "select public.admin_set_feature_flag($1, 'nope', true, 'turn it on')", [owner]))).message,
    ).toContain("unknown_flag");
  });
});

describe("geo rules", () => {
  it("seeds the India forex and CFD block", async () => {
    const { rows } = await db.as(service, "select country_code, asset_class, action from public.geo_rules order by asset_class");
    expect(rows).toEqual([
      { country_code: "IN", asset_class: "forex", action: "block" },
      { country_code: "IN", asset_class: "cfd", action: "block" },
    ]);
  });

  it("is hidden from anon and ordinary users", async () => {
    const a = await db.createUser();
    expect((await pgError(db.as(anon, "select * from public.geo_rules"))).code).toBe("42501");
    expect((await db.as(user(a), "select * from public.geo_rules")).rows).toEqual([]);
  });
});

describe("audit log", () => {
  it("is append-only, even for the service role and the database owner", async () => {
    const owner = await makeOwner();
    await db.as(service, "select public.admin_set_feature_flag($1, 'maintenance_mode', true, 'test write')", [owner]);
    for (const actor of [service, superuser]) {
      expect((await pgError(db.as(actor, "update public.audit_log set reason = 'edited'"))).code).toBe("42501");
      expect((await pgError(db.as(actor, "delete from public.audit_log"))).code).toBe("42501");
      expect((await pgError(db.as(actor, "truncate public.audit_log"))).code).toBe("42501");
    }
  });

  it("is invisible to non-staff", async () => {
    const a = await db.createUser();
    expect((await db.as(user(a), "select * from public.audit_log")).rows).toEqual([]);
    expect((await pgError(db.as(anon, "select * from public.audit_log"))).code).toBe("42501");
  });
});

describe("rate_limit_hit", () => {
  it("allows up to the limit in a window, then refuses", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const { rows } = await db.as(service, "select public.rate_limit_hit('test:key', 3600, 3) as ok");
      results.push(rows[0]!.ok);
    }
    expect(results).toEqual([true, true, true, false]);
  });

  it("is not callable by clients", async () => {
    expect((await pgError(db.as(anon, "select public.rate_limit_hit('x', 60, 1)"))).code).toBe("42501");
  });
});
