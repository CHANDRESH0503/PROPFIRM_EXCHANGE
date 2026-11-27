"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Last-resort boundary when the root layout itself fails. No providers are available here, so
 * the copy is inline English and the styles are inline.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#0b0d10",
          color: "#f2f0eb",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 420, margin: "0 auto", padding: "96px 20px" }}>
          <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
          <p style={{ color: "#c9cdd3", lineHeight: 1.6 }}>
            We have logged the problem. Try again in a moment.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              height: 44,
              padding: "0 16px",
              borderRadius: 10,
              border: 0,
              background: "#f2f0eb",
              color: "#0b0d10",
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
