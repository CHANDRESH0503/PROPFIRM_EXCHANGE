"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONSENT_COOKIE, consentCookie, parseConsent, type Consent } from "@/lib/analytics/consent";
import { publicEnv } from "@/lib/public-env";
import { createClient } from "@/lib/supabase/browser";
import { recordConsent } from "./consent-actions";

type Ctx = { open: () => void };
const ConsentContext = createContext<Ctx>({ open: () => {} });

function readCookie(): Consent | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  return parseConsent(match?.[1]);
}

/**
 * Starts PostHog only after the visitor accepts analytics, and only when a key is configured.
 * The SDK is imported on demand, so visitors who decline never download it. It never loads
 * remote scripts (no surveys or recordings) and identifies signed-in members by id only.
 */
async function startAnalytics() {
  if (!publicEnv.posthogKey) return;
  const { default: posthog } = await import("posthog-js");
  if (!posthog.__loaded) {
    posthog.init(publicEnv.posthogKey, {
      api_host: publicEnv.posthogHost,
      capture_pageview: "history_change",
      autocapture: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_external_dependency_loading: true,
      person_profiles: "identified_only",
      opt_out_capturing_by_default: true,
    });
  }
  posthog.opt_in_capturing();
  const { data } = await createClient().auth.getSession();
  if (data.session) posthog.identify(data.session.user.id);
}

async function stopAnalytics() {
  if (!publicEnv.posthogKey) return;
  const { default: posthog } = await import("posthog-js");
  if (posthog.__loaded) posthog.opt_out_capturing();
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoice] = useState<Consent | null | "unknown">("unknown");

  useEffect(() => {
    const stored = readCookie();
    // Reading the cookie after hydration keeps server and client markup identical.
    queueMicrotask(() => setChoice(stored));
    if (stored === "granted") void startAnalytics();
  }, []);

  const decide = useCallback((next: Consent) => {
    document.cookie = consentCookie(next, location.protocol === "https:");
    setChoice(next);
    void recordConsent(next === "granted");
    if (next === "granted") void startAnalytics();
    else void stopAnalytics();
  }, []);

  return (
    <ConsentContext.Provider value={{ open: () => setChoice(null) }}>
      {children}
      {choice === null ? <ConsentBanner onDecide={decide} /> : null}
    </ConsentContext.Provider>
  );
}

function ConsentBanner({ onDecide }: { onDecide: (c: Consent) => void }) {
  const t = useTranslations("consent");
  return (
    <section
      aria-label={t("label")}
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-2xl rounded-2xl border border-hairline bg-ink-deep p-4 shadow-(--shadow-overlay) md:bottom-4"
    >
      <div className="flex gap-3">
        <Cookie className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-text-soft">
          {t("body")}{" "}
          <Link href="/privacy" className="text-cyan underline underline-offset-4">
            {t("privacy")}
          </Link>
        </p>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" size="md" onClick={() => onDecide("denied")}>
          {t("decline")}
        </Button>
        <Button size="md" onClick={() => onDecide("granted")}>
          {t("accept")}
        </Button>
      </div>
    </section>
  );
}

/** Footer link that reopens the banner so a visitor can change or withdraw consent. */
export function ConsentSettingsLink({ className }: { className?: string }) {
  const t = useTranslations("consent");
  const { open } = useContext(ConsentContext);
  return (
    <button type="button" onClick={open} className={className}>
      {t("settings")}
    </button>
  );
}
