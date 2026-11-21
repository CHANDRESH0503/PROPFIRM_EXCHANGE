import { describe, expect, it } from "vitest";
import { superuser, setupTestDb } from "./support/db";

/**
 * Structural guarantees that must hold for every table and function, now and in future
 * migrations (CLAUDE.md §2.13). A new table without RLS, or a SECURITY DEFINER function left
 * executable by the API roles, fails here.
 */
const db = setupTestDb();

/** Functions the browser may call directly. Everything else is server (service role) only. */
const CLIENT_CALLABLE = new Map<string, Array<"anon" | "authenticated">>([
  ["complete_onboarding", ["authenticated"]],
]);

describe("database security invariants", () => {
  it("enables RLS on every table in public and private", async () => {
    const { rows } = await db.as(
      superuser,
      `select n.nspname || '.' || c.relname as name
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where c.relkind in ('r', 'p') and n.nspname = 'public' and not c.relrowsecurity`,
    );
    expect(rows.map((r) => r.name)).toEqual([]);
  });

  it("gives anon no write privilege on any public table", async () => {
    const { rows } = await db.as(
      superuser,
      `select table_name, privilege_type from information_schema.role_table_grants
        where grantee = 'anon' and table_schema = 'public'
          and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')`,
    );
    expect(rows).toEqual([]);
  });

  it("gives authenticated no table-wide write privilege on any public table", async () => {
    const { rows } = await db.as(
      superuser,
      `select table_name, privilege_type from information_schema.role_table_grants
        where grantee = 'authenticated' and table_schema = 'public'
          and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')`,
    );
    expect(rows).toEqual([]);
  });

  it("limits which functions the API roles can execute", async () => {
    const { rows } = await db.as<{ name: string; role: string }>(
      superuser,
      `select p.proname as name, r.rolname as role
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         cross join (values ('anon'), ('authenticated')) as r(rolname)
        where n.nspname in ('public', 'private')
          and p.prokind = 'f'
          and p.prorettype <> 'pg_catalog.trigger'::regtype
          and has_function_privilege(r.rolname, p.oid, 'execute')
          and has_schema_privilege(r.rolname, n.oid, 'usage')`,
    );
    const allowed = rows.filter((r) => {
      if (r.name === "has_role") return r.role === "authenticated"; // used inside RLS policies
      return CLIENT_CALLABLE.get(r.name)?.includes(r.role as "anon" | "authenticated");
    });
    expect(rows.filter((r) => !allowed.includes(r))).toEqual([]);
  });

  it("pins search_path on every SECURITY DEFINER function", async () => {
    const { rows } = await db.as(
      superuser,
      `select n.nspname || '.' || p.proname as name
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'private') and p.prosecdef
          and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`,
    );
    expect(rows).toEqual([]);
  });
});
