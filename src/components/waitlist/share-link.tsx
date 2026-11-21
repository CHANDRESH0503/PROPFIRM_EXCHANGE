"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Referral link with copy and native share (share only where the device supports it). */
export function ShareLink({ url, text }: { url: string; text: string }) {
  const t = useTranslations("waitlist.me");
  const [copied, setCopied] = useState(false);
  // False on the server and during hydration, so both render the same markup first.
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard blocked: the link stays selectable in the field. */
    }
  }

  return (
    <div className="space-y-3">
      <input
        readOnly
        value={url}
        aria-label={t("shareHeading")}
        onFocus={(e) => e.currentTarget.select()}
        className="h-12 w-full rounded-lg border border-hairline bg-surface px-4 font-mono text-sm text-text-soft"
      />
      <div className="flex gap-2.5">
        <Button type="button" variant="secondary" onClick={copy} aria-live="polite">
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? t("copied") : t("copy")}
        </Button>
        {canShare ? (
          <Button type="button" variant="secondary" onClick={() => navigator.share({ url, text }).catch(() => {})}>
            <Share2 aria-hidden="true" />
            {t("share")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function noopSubscribe() {
  return () => {};
}
