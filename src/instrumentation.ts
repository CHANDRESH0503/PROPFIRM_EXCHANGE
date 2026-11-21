import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/monitoring/scrub";

/**
 * Server and edge error tracking (docs/SYSTEM_DESIGN.md S4). Off unless SENTRY_DSN is set.
 * No performance tracing at launch: errors only, to stay inside the free plan.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.APP_ENV ?? "local",
    release: process.env.DEPLOYMENT_ID,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  });
}

export const onRequestError = Sentry.captureRequestError;
