import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          environment: "node",
          setupFiles: ["./src/test/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["supabase/tests/**/*.test.ts"],
          environment: "node",
          globalSetup: ["./supabase/tests/support/global-setup.ts"],
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
