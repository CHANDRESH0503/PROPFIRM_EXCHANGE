# Secrets

| Secret | Where it lives | Rotate by |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` (dev), `/etc/fundback/env` (VPS), GitHub env `staging` | Supabase → Settings → API keys → roll; update all three places; redeploy |
| `SUPABASE_DB_URL` (DB password) | `.env.local`, GitHub env `staging` | Supabase → Database → reset password; URL-encode special characters |
| `IP_HASH_SALT` | same as above | Replace; old hashes stop matching new ones (acceptable: they rotate monthly anyway) |
| `VOUCHER_ENCRYPTION_KEY` | VPS only | **Never rotate without re-encrypting vouchers** (Phase 1.7 adds a key id per row) |
| `TURNSTILE_SECRET_KEY` | VPS, `.env.local` | Cloudflare → Turnstile → rotate secret |
| `RESEND_API_KEY` | VPS | Resend → API keys: create new, deploy, delete old |
| `GOOGLE_CLIENT_SECRET` | Supabase dashboard (and `.env.local` for reference) | Google Cloud console → new secret → update Supabase |
| `CRON_SECRET` | VPS + the host timer | Replace in both, restart the timer |

Rules:
- `.env.local` and `/etc/fundback/env` are mode 600 and never committed (`.gitignore` covers `.env*` except `.env.example`).
- Staging and production never share a value.
- Any secret pasted into chat, a ticket or a screenshot is rotated the same day.
- The service-role key is read only in modules that import `server-only`; the build fails if a client component imports one.
