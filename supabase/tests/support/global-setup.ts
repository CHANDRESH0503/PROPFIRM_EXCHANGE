import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import type { TestProject } from "vitest/node";

/**
 * Builds a template database once per run: Supabase shim + every migration in order.
 * Each test file clones it (see db.ts), so files are isolated and fast.
 *
 * TEST_DATABASE_URL (CI) points at an existing server with a superuser.
 * Otherwise a throwaway cluster is started with the local initdb/pg_ctl.
 */
const TEMPLATE = "fundback_template";
const root = path.resolve(import.meta.dirname, "../../..");

let stopCluster: (() => void) | undefined;

function startEphemeralCluster(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "fundback-pg-"));
  const data = path.join(dir, "data");
  const port = String(55000 + Math.floor(Math.random() * 4000));
  try {
    execFileSync("initdb", ["-D", data, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--no-locale"], {
      stdio: "ignore",
    });
    execFileSync(
      "pg_ctl",
      ["-D", data, "-o", `-p ${port} -k ${dir} -c listen_addresses='' -c fsync=off -c full_page_writes=off`, "-w", "start"],
      { stdio: "ignore" },
    );
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(
      "Database tests need PostgreSQL 15+ binaries (initdb, pg_ctl) on PATH, or TEST_DATABASE_URL. " +
        `macOS: brew install postgresql@17. Cause: ${(error as Error).message}`,
    );
  }
  stopCluster = () => {
    try {
      execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "stop"], { stdio: "ignore" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  return `postgresql://postgres@localhost:${port}/postgres?host=${encodeURIComponent(dir)}`;
}

function withDatabase(url: string, database: string): string {
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
}

export default async function setup(project: TestProject) {
  const serverUrl = process.env.TEST_DATABASE_URL ?? startEphemeralCluster();

  const admin = new pg.Client({ connectionString: serverUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${TEMPLATE} with (force)`);
  await admin.query(`create database ${TEMPLATE}`);
  await admin.end();

  const tpl = new pg.Client({ connectionString: withDatabase(serverUrl, TEMPLATE) });
  await tpl.connect();
  try {
    const shim = readFileSync(path.join(root, "supabase/tests/support/auth-shim.sql"), "utf8");
    await tpl.query(shim);
    const dir = path.join(root, "supabase/migrations");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      try {
        await tpl.query(readFileSync(path.join(dir, file), "utf8"));
      } catch (error) {
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
      }
    }
  } finally {
    await tpl.end();
  }

  project.provide("dbServerUrl", serverUrl);
  project.provide("dbTemplate", TEMPLATE);

  return async () => {
    stopCluster?.();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    dbServerUrl: string;
    dbTemplate: string;
  }
}
