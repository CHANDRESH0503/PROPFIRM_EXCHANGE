import { TitleIcon } from "@/components/layout/title-icon";
import { Bell } from "lucide-react";
import { Suspense } from "react";
import Link from "next/link";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireOnboarded } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Skeleton } from "@/components/ui/skeleton";
import { DigestForm, Preferences, ReadItem } from "./forms";
import { inboxMessage } from "@/lib/notifications/inbox";
import { PushChannel, TelegramChannel } from "./channels";
import { vapidPublicKey } from "@/lib/notifications/push";
import { botUsername } from "@/lib/telegram/bot";

export const metadata = { title: "Notifications" };
export default function Page(props: PageProps<"/notifications">) {
  return (
    <Suspense fallback={<Skeleton className="h-72 rounded-lg" />}>
      <Inbox {...props} />
    </Suspense>
  );
}
async function Inbox({ searchParams }: PageProps<"/notifications">) {
  const { user, profile } = await requireOnboarded("/notifications");
  const db = await createClient();
  const cursor = z.coerce
    .number()
    .int()
    .positive()
    .safeParse((await searchParams).before);
  let q = db
    .from("notifications")
    .select("id,kind,detail,created_at,read_at")
    .eq("user_id", user.id)
    .order("id", { ascending: false })
    .limit(31);
  if (cursor.success) q = q.lt("id", cursor.data);
  const [items, prefs, t, telegram, bot, digest] = await Promise.all([
    q,
    db
      .from("notification_prefs")
      .select(
        "claim_status,redemption_status,coins_released,journal_review,quiet_start,quiet_end,daily_cap",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    getTranslations(),
    db.from("telegram_links").select("username").eq("user_id", user.id).maybeSingle(),
    botUsername(),
    db
      .from("calendar_digests")
      .select("active,currencies,send_hour")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (items.error || prefs.error || telegram.error || digest.error)
    throw new Error("inbox_unavailable");
  const date = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: profile.timezone ?? "UTC",
  });
  return (
    <div className="space-y-8">
      <h1 className="flex items-center gap-3 text-2xl font-bold">
        <TitleIcon icon={Bell} hue="var(--positive)" />
        {t("inbox.title")}
      </h1>
      {items.data.length ? (
        <ul className="divide-y divide-hairline border-y border-hairline">
          {items.data.slice(0, 30).flatMap((n) => {
            const message = inboxMessage(n.kind, n.detail);
            if (!message) return [];
            const { href, title } = message;
            return (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-x-4 py-3">
                <div>
                  <time className="block text-sm text-muted-foreground" dateTime={n.created_at}>
                    {date.format(new Date(n.created_at))}
                  </time>
                  <Link className="inline-flex min-h-11 items-center underline" href={href}>
                    {title}
                  </Link>
                </div>
                {!n.read_at && <ReadItem id={n.id} />}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-text-soft">{t("inbox.empty")}</p>
      )}
      {items.data.length > 30 && (
        <Link
          className="inline-flex min-h-11 items-center underline"
          href={`/notifications?before=${items.data[29]!.id}`}
        >
          {t("inbox.older")}
        </Link>
      )}
      <Preferences settings={prefs.data} />
      <section
        id="digest"
        aria-labelledby="digest-title"
        className="space-y-3 border-t border-hairline pt-8"
      >
        <h2 id="digest-title" className="text-lg font-semibold">
          {t("inbox.digestTitle")}
        </h2>
        <p className="measure text-sm text-text-soft">{t("inbox.digestHelp")}</p>
        <DigestForm settings={digest.data} />
      </section>
      <section aria-labelledby="channels" className="space-y-6 border-t border-hairline pt-8">
        <div className="space-y-1">
          <h2 id="channels" className="text-lg font-semibold">
            {t("channels.title")}
          </h2>
          <p className="text-sm text-text-soft">{t("channels.intro")}</p>
        </div>
        <div className="space-y-2">
          <h3 className="font-medium">{t("channels.telegram")}</h3>
          <p className="text-sm text-muted-foreground">{t("channels.telegramBody")}</p>
          <TelegramChannel
            linked={telegram.data ? (telegram.data.username ?? "") : null}
            available={Boolean(bot)}
          />
        </div>
        <div className="space-y-2">
          <h3 className="font-medium">{t("channels.push")}</h3>
          <p className="text-sm text-muted-foreground">{t("channels.pushBody")}</p>
          <PushChannel vapidKey={vapidPublicKey()} />
        </div>
      </section>
    </div>
  );
}
