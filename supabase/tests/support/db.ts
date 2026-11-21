import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, inject } from "vitest";

export type Actor =
  | { role: "anon" }
  | { role: "authenticated"; sub: string }
  | { role: "service_role" }
  | { role: "postgres" };

export const anon: Actor = { role: "anon" };
export const service: Actor = { role: "service_role" };
export const superuser: Actor = { role: "postgres" };
export const user = (sub: string): Actor => ({ role: "authenticated", sub });

export interface TestDb {
  /** Run one statement as `actor` in its own committed transaction, like a PostgREST request. */
  as<T extends pg.QueryResultRow = pg.QueryResultRow>(actor: Actor, sql: string, params?: unknown[]): Promise<pg.QueryResult<T>>;
  /** Create an auth user (the profile is created by trigger). */
  createUser(opts?: { email?: string; ref?: string }): Promise<string>;
  pool: pg.Pool;
}

/**
 * Gives a test file its own database cloned from the migrated template.
 * Call at the top level of a test file.
 */
export function setupTestDb(): TestDb {
  const name = `t_${randomUUID().replaceAll("-", "")}`;
  let pool: pg.Pool;
  let serverUrl: string;

  beforeAll(async () => {
    serverUrl = inject("dbServerUrl");
    const admin = new pg.Client({ connectionString: serverUrl });
    await admin.connect();
    await admin.query(`create database ${name} template ${inject("dbTemplate")}`);
    await admin.end();
    const u = new URL(serverUrl);
    u.pathname = `/${name}`;
    pool = new pg.Pool({ connectionString: u.toString(), max: 4 });
  });

  afterAll(async () => {
    await pool?.end();
    const admin = new pg.Client({ connectionString: serverUrl });
    await admin.connect();
    await admin.query(`drop database if exists ${name} with (force)`);
    await admin.end();
  });

  const db: TestDb = {
    get pool() {
      return pool;
    },
    async as(actor, sql, params = []) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        if (actor.role !== "postgres") {
          const claims = actor.role === "authenticated" ? { sub: actor.sub, role: actor.role } : { role: actor.role };
          await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
          await client.query(`set local role ${actor.role}`);
        }
        const result = await client.query(sql, params);
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    async createUser(opts = {}) {
      const email = opts.email ?? `${randomUUID()}@example.test`;
      const meta = opts.ref ? { ref: opts.ref } : {};
      const { rows } = await db.as<{ id: string }>(
        superuser,
        "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
        [email, meta],
      );
      return rows[0]!.id;
    },
  };
  return db;
}

/** Postgres error code of a rejected promise, for asserting why something was refused. */
export async function pgError(promise: Promise<unknown>): Promise<{ code?: string; message: string }> {
  try {
    await promise;
  } catch (error) {
    const e = error as { code?: string; message: string };
    return { code: e.code, message: e.message };
  }
  throw new Error("Expected the statement to fail, but it succeeded");
}
