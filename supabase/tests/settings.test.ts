import { expect, it } from "vitest";
import { setupTestDb, service, superuser, pgError } from "./support/db";
const db = setupTestDb();
it("requires owner authority, prevents stale writes and preserves historical config versions", async () => {
  const owner = await db.createUser();
  const save = (v: number, fields: object) =>
    db.as(service, "select save_economy_settings($1,$2,$3,'Rate update','test') as version", [
      owner,
      v,
      JSON.stringify(fields),
    ]);
  expect((await pgError(save(1, { hold_days: 20 }))).code).toBe("42501");
  await db.as(superuser, "insert into admin_roles(user_id,role) values($1,'owner')", [owner]);
  expect((await save(1, { hold_days: 20 })).rows[0]!.version).toBe(2);
  expect((await pgError(save(1, { hold_days: 0 }))).code).toBe("40001");
  await expect(save(2, { max_total_giveback_bps: 10 })).rejects.toThrow(/inconsistent/);
  expect(
    (await db.as(service, "select hold_days from economy_config order by version")).rows,
  ).toEqual([{ hold_days: 14 }, { hold_days: 20 }]);
});
