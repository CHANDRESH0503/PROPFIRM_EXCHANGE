import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  Calculator,
  CalendarClock,
  CircleDollarSign,
  Clock,
  Coins,
  Gauge,
  NotebookPen,
  Percent,
  Scale,
  TrendingDown,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { CALCULATORS, type CalculatorKey } from "@/lib/tools/calculators";
import { loose } from "./text";
import { cn } from "@/lib/utils";

const ICONS: Record<CalculatorKey, LucideIcon> = {
  "lot-size": Calculator,
  "pip-value": CircleDollarSign,
  "daily-room": Gauge,
  payout: Wallet,
  "risk-reward": Scale,
  "drawdown-recovery": TrendingDown,
  consistency: Percent,
  "challenge-cost": Coins,
};

/** Tool hues, cycled in list order so neighbours never share a colour. Gold stays for Coins. */
const HUES = ["var(--cyan)", "var(--pink)", "var(--violet)", "var(--lime)", "var(--brand-2)"];
const hue = (i: number) => ({ "--h": HUES[i % HUES.length] }) as React.CSSProperties;
const tile =
  "grid shrink-0 place-items-center rounded-xl border border-[color-mix(in_oklab,var(--h)_45%,transparent)] bg-[color-mix(in_oklab,var(--h)_16%,var(--ink))] text-(--h) shadow-[0_6px_16px_-8px_var(--h)]";

type Entry = { key: string; href: Route; title: string; short: string; icon: LucideIcon };

/** Every trader tool in one list, so the landing page, Today and /tools never drift apart. */
export async function toolEntries({ journal = false }: { journal?: boolean } = {}): Promise<
  Entry[]
> {
  const t = loose(await getTranslations("tools"));
  const nav = await getTranslations("journal");
  const entry = (e: Entry) => e;
  const calcs = CALCULATORS.map((k) =>
    entry({
      key: k,
      href: `/tools/${k}`,
      title: t(`${k}.title`),
      short: t(`${k}.short`),
      icon: ICONS[k],
    }),
  );
  return [
    ...(journal
      ? [
          entry({
            key: "journal",
            href: "/accounts",
            title: nav("title"),
            short: nav("intro"),
            icon: NotebookPen,
          }),
        ]
      : []),
    ...calcs,
    entry({
      key: "sessions",
      href: "/tools/market-sessions",
      title: t("sessions.title"),
      short: t("sessions.short"),
      icon: Clock,
    }),
    entry({
      key: "calendar",
      href: "/economic-calendar",
      title: t("calendar.title"),
      short: t("calendar.short"),
      icon: CalendarClock,
    }),
  ];
}

/**
 * `cards`: title and one-line description (landing page, /tools).
 * `compact`: icon and title in a dense grid (Today).
 */
export async function ToolDirectory({
  variant = "cards",
  journal = false,
  className,
}: {
  variant?: "cards" | "compact";
  journal?: boolean;
  className?: string;
}) {
  const entries = await toolEntries({ journal });
  if (variant === "compact") {
    return (
      <ul className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4", className)}>
        {entries.map(({ key, href, title, icon: Icon }, i) => (
          <li key={key} className="grid" style={hue(i)}>
            <Link
              href={href}
              className="flex min-h-16 items-center gap-3 rounded-2xl px-3 py-3 panel transition-[border-color,transform] duration-200 ease-(--ease-out-expo) hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--h)_60%,transparent)]"
            >
              <span className={cn(tile, "size-9")}>
                <Icon className="size-[1.125rem]" aria-hidden="true" />
              </span>
              <span className="text-sm leading-snug font-medium">{title}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className={cn("grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3", className)}>
      {entries.map(({ key, href, title, short, icon: Icon }, i) => (
        <li key={key} className="grid" style={hue(i)}>
          <Link
            href={href}
            className="group flex items-center gap-3 rounded-2xl p-3.5 panel transition-[border-color,transform,box-shadow] duration-200 ease-(--ease-out-expo) hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--h)_60%,transparent)] sm:min-h-28 sm:flex-col sm:items-stretch sm:justify-between sm:p-5"
          >
            <span className="flex min-w-0 flex-1 items-center gap-3.5 sm:items-start">
              <span className={cn(tile, "size-11")}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block font-heading text-base font-semibold">{title}</span>
                <span className="mt-0.5 line-clamp-2 block text-sm leading-snug text-muted-foreground sm:mt-1 sm:line-clamp-none sm:leading-relaxed">
                  {short}
                </span>
              </span>
            </span>
            <ArrowRight
              className="size-4 shrink-0 text-(--h) transition-transform group-hover:translate-x-1 sm:self-end"
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
