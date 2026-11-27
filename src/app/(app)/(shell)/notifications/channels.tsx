"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, BellOff, Copy, Globe, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  checkTelegramLink,
  connectTelegram,
  disconnectTelegram,
  removePushSubscription,
  savePushSubscription,
  type ChannelResult,
  type TelegramLink,
} from "./channel-actions";

type ErrorCode = Extract<ChannelResult, { ok: false }>["code"];

function errorKey(r: ChannelResult): ErrorCode | null {
  return r.ok ? null : r.code;
}

export function TelegramChannel({
  linked,
  available,
}: {
  linked: string | null;
  available: boolean;
}) {
  const t = useTranslations("channels");
  const [pending, start] = useTransition();
  const [error, setError] = useState<ErrorCode | null>(null);
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [waiting, setWaiting] = useState<"waiting" | "timeout" | null>(null);
  const router = useRouter();

  // After the deep link is shown, wait for the member to press Start in Telegram.
  useEffect(() => {
    if (!link) return;
    let stopped = false;
    const started = Date.now();
    async function poll() {
      if (stopped) return;
      if (Date.now() - started > 3 * 60_000) {
        setWaiting("timeout");
        return;
      }
      const { linked } = await checkTelegramLink().catch(() => ({ linked: false }));
      if (stopped) return;
      if (linked) {
        setLink(null);
        setWaiting(null);
        router.refresh();
        return;
      }
      timer = window.setTimeout(poll, 4_000);
    }
    let timer = window.setTimeout(poll, 3_000);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [link, router]);
  if (!available)
    return <p className="text-sm text-muted-foreground">{t("telegramUnavailable")}</p>;
  if (linked !== null) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-positive">
          {linked ? t("telegramLinkedAs", { name: linked }) : t("telegramLinked")}
        </p>
        <Button
          variant="secondary"
          size="sm"
          pending={pending}
          onClick={() => start(async () => setError(errorKey(await disconnectTelegram())))}
        >
          {t("disconnect")}
        </Button>
        {error ? (
          <p role="alert" className="w-full text-sm text-danger">
            {t(`errors.${error}`)}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {link ? (
        <div className="space-y-4 rounded-xl border border-hairline p-4">
          <p className="text-sm text-text-soft">{t("telegramSteps", { bot: link.bot })}</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={link.app}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 font-medium text-primary-foreground"
            >
              <Send className="size-4" aria-hidden="true" />
              {t("openTelegram")}
            </a>
            <a
              href={link.web}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-hairline bg-ink-deep/60 px-4 font-medium hover:bg-raised"
            >
              <Globe className="size-4" aria-hidden="true" />
              {t("openTelegramWeb")}
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
            <img
              src={link.qr}
              alt={t("qrAlt")}
              width={120}
              height={120}
              className="rounded-md bg-white"
            />
            <p className="max-w-xs text-sm text-muted-foreground">{t("qrHint")}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("manualHint", { bot: link.bot })}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-md bg-raised px-3 py-2 font-mono text-xs break-all">
                {link.command}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link.command);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                <Copy aria-hidden="true" />
                {copied ? t("copied") : t("copy")}
              </Button>
            </div>
          </div>
          <p role="status" className="text-sm text-text-soft">
            {waiting === "waiting"
              ? t("telegramWaiting")
              : waiting === "timeout"
                ? t("telegramTimeout")
                : ""}
          </p>
        </div>
      ) : (
        <Button
          pending={pending}
          onClick={() =>
            start(async () => {
              const r = await connectTelegram();
              if (r.ok && r.link) {
                setLink(r.link);
                setWaiting("waiting");
              }
              setError(errorKey(r));
            })
          }
        >
          <Send aria-hidden="true" />
          {t("connectTelegram")}
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {t(`errors.${error}`)}
        </p>
      ) : null}
    </div>
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type PushState = "unsupported" | "denied" | "off" | "on" | "loading";

export function PushChannel({ vapidKey }: { vapidKey: string | null }) {
  const t = useTranslations("channels");
  const [state, setState] = useState<PushState>("loading");
  const [pending, start] = useTransition();
  const [error, setError] = useState<ErrorCode | null>(null);

  useEffect(() => {
    let active = true;
    async function read() {
      if (
        !vapidKey ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        return "unsupported" as const;
      }
      if (Notification.permission === "denied") return "denied" as const;
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      return sub ? ("on" as const) : ("off" as const);
    }
    void read().then(
      (s) => active && setState(s),
      () => active && setState("unsupported"),
    );
    return () => {
      active = false;
    };
  }, [vapidKey]);

  function enable() {
    if (!vapidKey) return;
    start(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          }));
        const r = await savePushSubscription(sub.toJSON());
        setError(errorKey(r));
        if (r.ok) setState("on");
        else await sub.unsubscribe();
      } catch {
        setError("failed");
      }
    });
  }

  function disable() {
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });
  }

  if (state === "loading") return <p className="text-sm text-muted-foreground">{t("checking")}</p>;
  if (state === "unsupported")
    return <p className="text-sm text-muted-foreground">{t("pushUnsupported")}</p>;
  if (state === "denied") return <p className="text-sm text-muted-foreground">{t("pushDenied")}</p>;
  return (
    <div className="space-y-2">
      {state === "on" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-positive">{t("pushOn")}</p>
          <Button variant="secondary" size="sm" pending={pending} onClick={disable}>
            <BellOff aria-hidden="true" />
            {t("pushDisable")}
          </Button>
        </div>
      ) : (
        <Button pending={pending} onClick={enable}>
          <Bell aria-hidden="true" />
          {t("pushEnable")}
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {t(`errors.${error}`)}
        </p>
      ) : null}
    </div>
  );
}
