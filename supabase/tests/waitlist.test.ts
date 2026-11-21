import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { anon, pgError, service, superuser, setupTestDb, user } from "./support/db";

const db = setupTestDb();

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const newToken = () => sha(randomBytes(32).toString("hex"));

let ipCounter = 0;
const uniqueIp = () => sha(`ip-${++ipCounter}`);

interface Member {
  signup_id: string;
  status: "pending" | "confirmed";
  referral_code: string;
  confirmed_referrals: number;
  position: string | null;
  total_confirmed: string;
}

async function join(email: string, opts: { ref?: string; ip?: string | null } = {}) {
  const token = newToken();
  const { rows } = await db.as<{ signup_id: string; is_new: boolean; status: string }>(
    service,
    "select * from public.waitlist_join($1, $2, $3, $4, $5, $6)",
    [email, opts.ref ?? null, token, opts.ip === undefined ? uniqueIp() : opts.ip, "GB", "test"],
  );
  return { ...rows[0]!, token };
}

async function open(token: string): Promise<Member | null> {
  const { rows } = await db.as<Member>(service, "select (public.waitlist_open($1)).*", [token]);
  return rows[0]?.signup_id ? rows[0] : null;
}

describe("waitlist", () => {
  it("joins once per email; a repeat join rotates the access token", async () => {
    const first = await join("Repeat@Example.com");
    expect(first.is_new).toBe(true);
    const second = await join("repeat@example.com");
    expect(second).toMatchObject({ signup_id: first.signup_id, is_new: false });

    expect(await open(first.token)).toBeNull();
    expect((await open(second.token))?.signup_id).toBe(first.signup_id);
  });

  it("gives no position until the email is confirmed, then counts confirmed members", async () => {
    const a = await join("pos-a@example.com");
    const b = await join("pos-b@example.com");
    const before = await db.as(service, "select count(*)::int as n from public.waitlist_signups where status = 'confirmed'");

    const memberA = await open(a.token);
    expect(memberA).toMatchObject({ status: "confirmed" });
    const memberB = await open(b.token);
    expect(Number(memberB!.position)).toBe(Number(memberA!.position) + 1);
    expect(Number(memberB!.total_confirmed)).toBe(before.rows[0]!.n + 2);
  });

  it("moves a member up for each confirmed referral, by the configured boost", async () => {
    await db.as(superuser, "update public.site_settings set value = '2'::jsonb where key = 'waitlist.referral_boost'");
    const referrer = await join("boost-ref@example.com");
    const referrerView = (await open(referrer.token))!;
    const others = [];
    for (let i = 0; i < 4; i++) others.push(await join(`boost-other-${i}@example.com`));
    for (const o of others) await open(o.token);

    const start = Number((await open(referrer.token))!.position);

    const friend = await join("boost-friend@example.com", { ref: referrerView.referral_code });
    expect(Number((await open(referrer.token))!.position)).toBe(start); // pending referral does not count
    await open(friend.token);

    const after = (await open(referrer.token))!;
    expect(after.confirmed_referrals).toBe(1);
    expect(Number(after.position)).toBe(start - 2);
    await db.as(superuser, "update public.site_settings set value = '5'::jsonb where key = 'waitlist.referral_boost'");
  });

  it("counts a referral once, even if the friend opens the link many times", async () => {
    const referrer = await join("once-ref@example.com");
    const code = (await open(referrer.token))!.referral_code;
    const friend = await join("once-friend@example.com", { ref: code });
    await open(friend.token);
    await open(friend.token);
    await open(friend.token);
    expect((await open(referrer.token))!.confirmed_referrals).toBe(1);
  });

  it("does not count a referral from the same network, or with no network signal", async () => {
    const ip = sha("shared-network");
    const referrer = await join("net-ref@example.com", { ip });
    const code = (await open(referrer.token))!.referral_code;
    await open((await join("net-friend-1@example.com", { ref: code, ip })).token);
    await open((await join("net-friend-2@example.com", { ref: code, ip: null })).token);
    expect((await open(referrer.token))!.confirmed_referrals).toBe(0);
  });

  it("ignores unknown referral codes", async () => {
    const a = await join("unknown-ref@example.com", { ref: "ZZZZZZZZ" });
    const { rows } = await db.as(service, "select referred_by from public.waitlist_signups where id = $1", [a.signup_id]);
    expect(rows[0]!.referred_by).toBeNull();
  });

  it("rejects malformed emails", async () => {
    expect((await pgError(join("not-an-email"))).code).toBe("23514");
  });

  it("is invisible to clients and only callable by the server", async () => {
    const a = await db.createUser();
    expect((await pgError(db.as(anon, "select * from public.waitlist_signups"))).code).toBe("42501");
    expect((await db.as(user(a), "select * from public.waitlist_signups")).rows).toEqual([]);
    expect(
      (await pgError(db.as(anon, "select * from public.waitlist_join('x@y.co', null, $1, null, null, null)", [newToken()]))).code,
    ).toBe("42501");
    expect((await pgError(db.as(anon, "select public.waitlist_open($1)", [newToken()]))).code).toBe("42501");
  });

  it("lets support staff read the list", async () => {
    const staff = await db.createUser();
    await db.as(superuser, "insert into public.admin_roles (user_id, role) values ($1, 'support')", [staff]);
    await join("staff-visible@example.com");
    const { rows } = await db.as(user(staff), "select email from public.waitlist_signups where email = 'staff-visible@example.com'");
    expect(rows).toHaveLength(1);
  });
});
