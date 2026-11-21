#!/usr/bin/env node
// Bootstrap the first owner: `pnpm admin:grant you@example.com`.
// The person must have signed in once so their auth user exists. Later roles are granted in
// admin by an owner (audited). Runs as the database owner via SUPABASE_DB_URL.
import { existsSync } from "node:fs";
import pg from "pg";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const email = process.argv[2];
if (!email || !email.includes("@")) {
  console.error("usage: pnpm admin:grant <email>");
  process.exit(1);
}
if (!process.env.SUPABASE_DB_URL) {
  console.error("SUPABASE_DB_URL is not set.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const { rows } = await client.query("select private.bootstrap_owner($1) as id", [email]);
  console.log(`owner role granted to user ${rows[0].id}. Sign in and open /admin to set up two-factor.`);
} catch (error) {
  console.error(`failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
