"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "dashboard", href: "/admin" },
  { key: "waitlist", href: "/admin/waitlist" },
  { key: "flags", href: "/admin/settings" },
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
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap md:w-full",
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
