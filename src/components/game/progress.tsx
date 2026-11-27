import { cn } from "@/lib/utils";
import { BarFill, CountUp } from "./count-up";

/** Gold Coin glyph: authored SVG, gold only because it means Coins. */
export function CoinGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-4 shrink-0", className)} aria-hidden="true">
      <circle cx="8" cy="8" r="7.25" fill="var(--gold)" />
      <circle
        cx="8"
        cy="8"
        r="5"
        fill="none"
        stroke="color-mix(in oklab, var(--gold) 55%, black)"
        strokeWidth="1.2"
      />
      <path
        d="M8 4.8v6.4M6.4 6.4h3.2"
        stroke="color-mix(in oklab, var(--gold) 45%, black)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CoinCounter({
  value,
  label,
  countKey,
  className,
}: {
  value: number;
  label: string;
  /** When set, a change since this tab last showed the figure counts up once. */
  countKey?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono tabular font-bold text-gold",
        className,
      )}
    >
      <CoinGlyph />
      <span>
        {countKey ? <CountUp value={value} storageKey={countKey} /> : value.toLocaleString("en-US")}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Hexagonal level badge with the tier number. */
export function LevelBadge({
  tier,
  name,
  className,
}: {
  tier: number;
  name: string;
  className?: string;
}) {
  return (
    <span
      title={name}
      className={cn(
        "grid size-8 shrink-0 place-items-center bg-[linear-gradient(160deg,#fff1b8_0%,var(--gold)_38%,var(--gold-2)_100%)] font-heading text-sm font-black text-ink drop-shadow-[0_4px_10px_rgb(255_157_46/0.55)] [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]",
        className,
      )}
    >
      {tier}
      <span className="sr-only">{name}</span>
    </span>
  );
}

/** XP bar: a violet-to-cyan beam with a highlight, on a recessed track. */
export function XpBar({
  value,
  max,
  label,
  tone = "xp",
  animateKey,
  className,
}: {
  value: number;
  max: number;
  label: string;
  /** `gold` for progress measured in Coins (a reward goal). */
  tone?: "xp" | "gold";
  /** When set, a gain since this tab last showed the bar grows from the old width. */
  animateKey?: string;
  className?: string;
}) {
  const fill = cn(
    "h-full rounded-full transition-[width] duration-700 ease-(--ease-out-expo)",
    tone === "gold"
      ? "[background-image:linear-gradient(180deg,rgb(255_255_255/0.4),transparent_55%),linear-gradient(90deg,var(--gold),var(--gold-2))] shadow-[0_2px_10px_-2px_rgb(255_157_46/0.8)]"
      : "[background-image:linear-gradient(180deg,rgb(255_255_255/0.35),transparent_55%),linear-gradient(90deg,var(--xp),var(--xp-2))] shadow-[0_2px_8px_-2px_rgb(47_214_255/0.7)]",
  );
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={cn(
        "h-2.5 overflow-hidden rounded-full bg-ink-deep/80 shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)] ring-1 ring-hairline",
        className,
      )}
    >
      {animateKey ? (
        <BarFill pct={pct} storageKey={animateKey} className={fill} />
      ) : (
        <div className={fill} style={{ width: `${pct}%` }} />
      )}
    </div>
  );
}
