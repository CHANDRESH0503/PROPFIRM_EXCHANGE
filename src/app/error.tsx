"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Route-level error boundary. Shows a plain recovery path; details go to logs, never the screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  useEffect(() => {
    Sentry.captureException(error);
    console.error(JSON.stringify({ level: "error", event: "ui.error_boundary", digest: error.digest ?? null }));
  }, [error]);
  return (
    <div className="mx-auto max-w-md px-5 py-24">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-3 text-text-soft">{t("body")}</p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-muted-foreground">Ref {error.digest}</p> : null}
      <Button className="mt-6" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
