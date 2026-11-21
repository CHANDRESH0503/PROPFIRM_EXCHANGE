"use client";

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

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Phone: fixed bottom bar, thumb-reachable, 56 px targets, safe-area aware. */
export function BottomTabs() {
  const t = useTranslations("nav.tabs");
  const isActive = useActive();
  return (
    <nav
      aria-label="App"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {APP_TABS.map(({ key, href }) => {
          const Icon = ICONS[key];
          const active = isActive(href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-text-soft",
                )}
              >
                <Icon className="size-[1.375rem]" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
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
export function TopTabs() {
  const t = useTranslations("nav.tabs");
  const isActive = useActive();
  return (
    <nav aria-label="App" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {APP_TABS.map(({ key, href }) => {
          const active = isActive(href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-lg px-3.5 text-sm font-medium transition-colors",
                  active ? "bg-raised text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
