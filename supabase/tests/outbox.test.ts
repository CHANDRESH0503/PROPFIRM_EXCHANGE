import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { setupTestDb, service, superuser } from "./support/db";

const db = setupTestDb();

async function enqueue(email: string, nonce = randomUUID()) {
  const hash = nonce.replaceAll("-", "").repeat(2);
  await db.as(service, "select * from waitlist_enqueue($1,null,$2,null,null,null,$3)", [
    email,
    hash,
    nonce,
  ]);
  return nonce;
}
const lease = (nonce: string) => db.as(service, "select * from lease_email(1,$1)", [nonce]);
const finish = (nonce: string, token: string, sent: boolean) =>
  db.as(service, "select finish_email($1,$2,$3)", [nonce, token, sent]);

it("serializes concurrent delivery and fences stale acknowledgements after lease expiry", async () => {
  const nonce = await enqueue("one@example.test");
  const leases = (await Promise.all([lease(nonce), lease(nonce)])).flatMap((r) => r.rows);
  expect(leases).toHaveLength(1);
  await finish(nonce, leases[0]!.lease, false);
  expect((await lease(nonce)).rows).toHaveLength(0);
  await db.as(superuser, "update private.email_outbox set available_at=now() where nonce=$1", [
    nonce,
  ]);
  const second = (await lease(nonce)).rows[0]!;
  await finish(nonce, leases[0]!.lease, true);
  expect(
    (await db.as(superuser, "select lease from private.email_outbox where nonce=$1", [nonce]))
      .rows[0]?.lease,
  ).toBe(second.lease);
  await finish(nonce, second.lease, true);
  expect(
    (await db.as(superuser, "select sent,failures from private.email_daily_counts")).rows,
  ).toEqual([{ sent: "1", failures: "1" }]);
});

it("rotates queued links and respects repeated suppression events", async () => {
  const old = await enqueue("two@example.test");
  const fresh = await enqueue("two@example.test");
  expect((await lease(old)).rows).toHaveLength(0);
  for (let i = 0; i < 2; i++) await db.as(service, "select suppress_email('Two@example.test')");
  expect((await lease(fresh)).rows).toHaveLength(0);
});

it("rolls back a join when its delivery intent cannot be stored", async () => {
  const duplicate = await enqueue("three@example.test");
  await expect(enqueue("four@example.test", duplicate)).rejects.toThrow();
  expect(
    (await db.as(superuser, "select id from waitlist_signups where email='four@example.test'"))
      .rows,
  ).toHaveLength(0);
});
