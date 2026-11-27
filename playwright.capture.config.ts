import { defineConfig, devices } from "@playwright/test";

/** Visual capture against an already running server (pnpm dev). Not part of the suite. */
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: process.env.CAPTURE_MATCH ?? "screens.capture.ts",
  reporter: [["list"]],
  use: { baseURL: process.env.CAPTURE_URL ?? "http://localhost:3000" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
