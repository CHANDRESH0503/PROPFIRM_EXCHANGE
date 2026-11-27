import { cn } from "@/lib/utils";
import { brand } from "@/config/brand";

const formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * A Coin figure. Gold is reserved for Coins, levels and rewards (12-design.md), so this is the
 * one place gold text comes from. Pending Coins render muted: they are not spendable yet.
 */
export function CoinAmount({
  value,
  status = "available",
  size = "md",
  showUnit = true,
  className,
}: {
  value: number;
  status?: "available" | "pending";
  size?: "sm" | "md" | "lg" | "xl";
  showUnit?: boolean;
  className?: string;
}) {
  const unit = value === 1 ? brand.currency.coins.singular : brand.currency.coins.plural;
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 font-mono tabular",
        status === "available" ? "text-gold" : "text-muted-foreground",
        {
          sm: "text-sm",
          md: "text-base",
          lg: "text-2xl font-semibold",
          xl: "text-4xl font-semibold tracking-tight",
        }[size],
        className,
      )}
    >
      <CoinGlyph className={size === "xl" || size === "lg" ? "size-[0.8em]" : "size-[0.9em]"} />
      <span>{formatter.format(value)}</span>
      {showUnit ? <span className="font-sans text-[0.75em] font-medium">{unit}</span> : null}
      {status === "pending" ? <span className="font-sans text-[0.75em]">pending</span> : null}
    </span>
  );
}

/** The Coin mark: a milled rim and a struck centre, drawn so it reads at 12 px. */
export function CoinGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cn("shrink-0 self-center", className)} aria-hidden="true">
      <circle cx="10" cy="10" r="8.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle
        cx="10"
        cy="10"
        r="5.25"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path d="M10 7.2v5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
