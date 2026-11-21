# Supabase project setup

Do this once per project (staging, then production). The code assumes every item below.

## 1. Auth → URL configuration

- **Site URL:** the environment's origin, e.g. `https://staging.fundback.example` (local: `http://localhost:3000`).
- **Redirect URLs** (allow list), one per origin you use:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3100/auth/callback` (end-to-end tests)
  - `https://<env domain>/auth/callback`

If the callback is not on the list, Supabase silently sends people to the Site URL instead.

## 2. Auth → Email templates → Magic link

Use the token-hash link so a sign-in email works on any device, not only the browser that asked for it:

```html
<h2>Sign in to Fundback</h2>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">Sign in</a></p>
<p>This link works once and expires in an hour. If you didn't ask for it, ignore this email.</p>
```

`/auth/callback` also accepts the default `?code=` (PKCE) link, so nothing breaks before this is changed.

Do the same for **Confirm signup** (`type=email`).

## 3. Auth → Providers

- **Email:** enabled. "Confirm email" on.
- **Google:** enabled with `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. In Google Cloud, the authorised redirect URI is `https://<ref>.supabase.co/auth/v1/callback`.

## 4. Auth → Multi-factor

- TOTP (authenticator app) **enabled**. Admin pages require an `aal2` session (`requireStaff`).

## 5. Auth → Bot and abuse protection

- **CAPTCHA: off in Supabase.** The app verifies Turnstile itself on the server before calling Supabase (`src/lib/http/turnstile.ts`); a token is single-use, so verifying twice would fail.
- Rate limits: keep the defaults. The app adds its own durable limits (`src/lib/http/rate-limit.ts`).

## 6. Auth → JWT signing keys

Switch to **asymmetric (ECC P-256) signing keys** when convenient. `getClaims()` then verifies tokens locally instead of calling Auth on every request (docs/SYSTEM_DESIGN.md, task B3). No code change is needed.

## 7. SMTP (before launch)

Supabase's built-in mailer sends only a few emails an hour. Before launch, set **Auth → SMTP** to Resend on the real domain (with SPF, DKIM, DMARC), the same provider the app uses for waitlist mail.

## 8. Database

- Apply migrations: `pnpm db:status`, then `pnpm db:migrate` (needs `SUPABASE_DB_URL`).
- Regenerate types: `pnpm db:types` (needs `npx supabase login` once).
- First owner: sign in once, then `pnpm admin:grant <email>`, then open `/admin` and set up two-factor.

## 9. Production only

- Supabase **Pro** plan: daily backups, point-in-time recovery, no pausing.
- Never run `pnpm db:seed` against production (the script refuses).
