import { expect, it } from "vitest";
import { setupTestDb, service, user } from "./support/db";

const db = setupTestDb();

it("records consent changes server-side only, readable by the member", async () => {
  const member = await db.createUser();
  const read = async () =>
    (await db.as(user(member), "select analytics_consent from profiles")).rows[0]!
      .analytics_consent;
  expect(await read()).toBeNull();
  await db.as(service, "select set_analytics_consent($1,true)", [member]);
  expect(await read()).toBe(true);
  await db.as(service, "select set_analytics_consent($1,false)", [member]);
  expect(await read()).toBe(false);
  await expect(db.as(service, "select set_analytics_consent($1,null)", [member])).rejects.toThrow(
    /true or false/,
  );
  // Members cannot set it directly or call the function.
  await expect(
    db.as(user(member), "update profiles set analytics_consent=true where id=$1", [member]),
  ).rejects.toThrow(/permission/);
  await expect(
    db.as(user(member), "select set_analytics_consent($1,true)", [member]),
  ).rejects.toThrow(/permission/);
});
