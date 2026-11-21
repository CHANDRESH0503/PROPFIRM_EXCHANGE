# Backups and restore

**What runs:** `.github/workflows/backup.yml` nightly at 02:00 IST: `pg_dump` (custom format) of `public`, `private`, `auth` and `supabase_migrations`, encrypted with `age` to the owner's public key, uploaded to Backblaze B2. Retention: 14 daily, 8 weekly. Supabase Pro adds its own daily backups and point-in-time recovery in production.

**Verified 21 Nov 2026 (drill against staging):** backup → decrypt → restore into a fresh local Postgres 17. All 36 tables (392 rows) identical, 10 of 10 RLS policies and 16 of 16 functions present.

## One-time setup

1. `age-keygen -o fundback-backup.agekey` on your own machine. Store the file in your password manager and on an offline drive. **Losing it makes every backup unreadable.**
2. Put the public key (`age1…`) in the GitHub `production` environment as `BACKUP_AGE_RECIPIENT`, with `PROD_SUPABASE_DB_URL`, `B2_ACCOUNT_ID`, `B2_APPLICATION_KEY` (a key limited to the bucket) and `BACKUP_BUCKET`.
3. Run the workflow once by hand (Actions → Backup → Run) and check the file appears in B2.

## Restore (drill every quarter, on staging or local)

```sh
rclone copy b2:<bucket>/production/daily/<file>.dump.age .
BACKUP_AGE_IDENTITY=~/keys/fundback-backup.agekey \
TARGET_DB_URL=postgresql://... \
  deploy/backup/restore.sh <file>.dump.age
```

- Target a **new** Supabase project (or staging), never production, unless production itself is lost. Set `PRODUCTION_DB_HOST` so the script refuses it without `YES_PRODUCTION=1`.
- A local Postgres target needs the roles `anon`, `authenticated` and `service_role` first.
- Afterwards: point the app's env at the restored project, run `pnpm db:status` (no drift), and run the e2e suite against it.

## Point-in-time recovery (production, Supabase Pro)

Use Supabase Dashboard → Database → Backups → PITR to roll back to a minute before the incident. Prefer this over a nightly dump when the problem is recent.

Record each drill (date, file, result) at the end of this file.

| Date | Source | Result |
|---|---|---|
| 2026-11-21 | staging, local file | 36/36 tables, 392 rows identical; policies and functions match |
