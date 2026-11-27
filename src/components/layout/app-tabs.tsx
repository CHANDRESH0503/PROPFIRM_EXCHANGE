"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarCheck2, Gift, ShieldCheck, Tag, UserRound, type LucideIcon } from "lucide-react";
import { APP_TABS, type AppTabKey } from "@/config/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<AppTabKey, LucideIcon> = {
  today: CalendarCheck2,
  deals: Tag,
  rewards: Gift,
  accounts: ShieldCheck,
  profile: UserRound,
};

/** Each tab owns a hue, so the bar reads as a set of places rather than one grey list. */
const HUES: Record<AppTabKey, string> = {
  today: "var(--violet)",
  deals: "var(--pink)",
  rewards: "var(--gold)",
  accounts: "var(--cyan)",
  profile: "var(--positive)",
};

type IsActive = (href: string, also: readonly string[]) => boolean;
const none: IsActive = () => false;

function activeFor(pathname: string): IsActive {
  const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (href, also) => under(href) || also.some(under);
}

/**
 * The tab bars read the URL to highlight the current tab. With Cache Components that read must
 * sit inside Suspense on dynamic routes, so the bars stream with a fallback that is the same bar
 * without a highlight: the shell never waits for the URL.
 */
function WithPath({ render }: { render: (isActive: IsActive) => React.ReactNode }) {
  return <>{render(activeFor(usePathname()))}</>;
}

export function BottomTabs() {
  return (
    <Suspense fallback={<BottomBar isActive={none} />}>
      <WithPath render={(isActive) => <BottomBar isActive={isActive} />} />
    </Suspense>
  );
}

export function TopTabs() {
  return (
    <Suspense fallback={<TopBar isActive={none} />}>
      <WithPath render={(isActive) => <TopBar isActive={isActive} />} />
    </Suspense>
  );
}

/** Phone: fixed bottom bar, thumb-reachable, 56 px targets, safe-area aware. */
function BottomBar({ isActive }: { isActive: IsActive }) {
  const t = useTranslations("nav.tabs");
  return (
    <nav
      aria-label="App"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-ink-deep pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_-12px_rgb(5_2_20/0.9)] md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {APP_TABS.map(({ key, href, also }) => {
          const Icon = ICONS[key];
          const active = isActive(href, also);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                style={{ "--h": HUES[key] } as React.CSSProperties}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold transition-colors",
                  active ? "text-(--h)" : "text-muted-foreground hover:text-text-soft",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-[background-color,box-shadow]",
                    active &&
                      "bg-[color-mix(in_oklab,var(--h)_22%,transparent)] shadow-[0_4px_14px_-4px_var(--h)]",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
                </span>
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop: tabs in the top bar. */
function TopBar({ isActive }: { isActive: IsActive }) {
  const t = useTranslations("nav.tabs");
  return (
    <nav aria-label="App" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {APP_TABS.map(({ key, href, also }) => {
          const active = isActive(href, also);
          const Icon = ICONS[key];
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                style={{ "--h": HUES[key] } as React.CSSProperties}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                  active
                    ? "border-[color-mix(in_oklab,var(--h)_55%,transparent)] bg-[color-mix(in_oklab,var(--h)_18%,transparent)] text-foreground"
                    : "border-transparent text-text-soft hover:bg-brand/12 hover:text-foreground",
                )}
              >
                <Icon className="size-4 text-(--h)" aria-hidden="true" />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
