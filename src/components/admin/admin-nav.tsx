"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "dashboard", href: "/admin" },
  { key: "users", href: "/admin/users" },
  { key: "support", href: "/admin/support" },
  { key: "appeals", href: "/admin/claims/appeals" },
  { key: "dataRequests", href: "/admin/data-requests" },
  { key: "stock", href: "/admin/rewards" },
  { key: "economy", href: "/admin/economy" },
  { key: "finance", href: "/admin/finance" },
  { key: "campaigns", href: "/admin/campaigns" },
  { key: "claims", href: "/admin/claims" },
  { key: "catalogue", href: "/admin/catalogue" },
  { key: "help", href: "/admin/help" },
  { key: "changelog", href: "/admin/changelog" },
  { key: "spin", href: "/admin/spin" },
  { key: "waitlist", href: "/admin/waitlist" },
  { key: "flags", href: "/admin/settings" },
  { key: "health", href: "/admin/health" },
  { key: "audit", href: "/admin/audit" },
] as const;

/** Horizontal scroller on phones (the owner approves from a phone), a rail on desktop. */
export function AdminNav() {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
      <ul className="flex gap-1 md:flex-col">
        {ITEMS.map(({ key, href }) => {
          // The most specific matching entry wins (Claims vs Claim appeals).
          const matches = ITEMS.filter((i) =>
            i.href === "/admin"
              ? pathname === i.href
              : pathname === i.href || pathname.startsWith(`${i.href}/`),
          );
          const best = matches.sort((a, b) => b.href.length - a.href.length)[0];
          const active = best?.href === href;
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors md:w-full",
                  active
                    ? "border-brand/60 bg-brand/20 text-foreground shadow-[0_6px_16px_-8px_rgb(123_77_255/0.8)]"
                    : "border-transparent text-text-soft hover:bg-brand/12 hover:text-foreground",
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
