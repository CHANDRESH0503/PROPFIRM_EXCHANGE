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
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    // Test what ships: a production build, no hot reload to disturb navigation mid-test.
    command: `pnpm exec next build && pnpm exec next start --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // Only the mail sink is set here; everything else comes from .env.local (APP_ENV=local,
    // no Resend key, no Turnstile secret, so verification and email stay local).
    env: { DEV_MAIL_DIR: MAIL_DIR },
  },
});
