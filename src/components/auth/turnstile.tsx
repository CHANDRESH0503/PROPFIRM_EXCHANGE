"use client";

import { useEffect, useRef } from "react";
import { publicEnv } from "@/lib/public-env";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | undefined;

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = undefined;
      reject(new Error("turnstile script failed"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Cloudflare Turnstile in "managed" mode: usually invisible, a checkbox only when Cloudflare is
 * unsure. Renders the hidden `cf-turnstile-response` input inside the form. Without a site key
 * (local development) it renders nothing and the server skips verification outside production.
 * `resetKey` changes after each submit, because a token is single-use.
 */
export function Turnstile({ action, resetKey }: { action: string; resetKey?: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const siteKey = publicEnv.turnstileSiteKey;

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile || widgetId.current) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          action,
          theme: "dark",
          appearance: "interaction-only",
          "response-field-name": "cf-turnstile-response",
        });
      })
      .catch(() => {
        /* The server rejects the submit with a clear message; nothing to do here. */
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, action]);

  useEffect(() => {
    if (resetKey !== undefined && widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  }, [resetKey]);

  if (!siteKey) return null;
  return <div ref={ref} className="min-h-0 empty:hidden" />;
}
