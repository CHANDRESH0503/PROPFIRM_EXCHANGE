import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end journeys on a phone viewport (the main audience) and desktop.
 * Needs a Supabase project (staging) in .env.local. Emails are read from the local mail sink,
 * so the app must run with APP_ENV=local and no Resend key.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
export const MAIL_DIR = path.resolve("test-results/mail");

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Pages stream from the remote staging database; 10 s absorbs its latency under two workers.
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // Journeys start with a recorded "essential only" choice so the cookie banner does not sit
    // over the controls they exercise. tests/e2e/consent.spec.ts covers the banner itself.
    storageState: {
      cookies: [
        {
          name: "analytics_consent",
          value: "denied",
          domain: "localhost",
          path: "/",
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    // Test what ships: a production build, no hot reload to disturb navigation mid-test.
    command: `pnpm exec next build && pnpm exec next start --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    // Exercise the production build with local transports even when .env.local contains
    // live email and CAPTCHA credentials for interactive testing.
    env: {
      APP_ENV: "local",
      DEV_MAIL_DIR: MAIL_DIR,
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
    },
  },
});
