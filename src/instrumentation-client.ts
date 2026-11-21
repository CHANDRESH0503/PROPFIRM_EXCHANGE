import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/monitoring/scrub";

// Browser error tracking. Off unless NEXT_PUBLIC_SENTRY_DSN is set at build time.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? "local",
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
