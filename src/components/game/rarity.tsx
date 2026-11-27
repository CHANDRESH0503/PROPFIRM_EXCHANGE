import { cn } from "@/lib/utils";
import type { Rarity } from "@/lib/catalogue/rarity";

/** Border colours per rarity; read from tokens so an admin theme applies. */
export const RARITY_BORDER: Record<Rarity, string> = {
  common: "border-common/55",
  rare: "border-rare",
  epic: "border-epic",
  legendary: "border-legendary",
};

/** The rarity hue as a CSS colour, for washes, glows and gems. */
const HUE: Record<Rarity, string> = {
  common: "var(--common)",
  rare: "var(--rare)",
  epic: "var(--epic)",
  legendary: "var(--legendary)",
};

const TAB: Record<Rarity, string> = {
  common: "bg-gradient-to-r from-common to-[#d6d9ee] text-ink",
  rare: "bg-gradient-to-r from-rare to-cyan text-ink",
  epic: "bg-gradient-to-r from-epic to-pink text-ink",
  legendary: "bg-gradient-to-r from-legendary to-[#ff6a3c] text-ink",
};

/** A faceted gem, drawn: the rarity's mark on the tab. */
function Gem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={cn("size-3 shrink-0", className)} aria-hidden="true">
      <path d="M6 .8 11.2 4.4 6 11.2.8 4.4Z" fill="currentColor" fillOpacity="0.9" />
      <path
        d="M.8 4.4h10.4M6 .8 4 4.4l2 6.8 2-6.8Z"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.55"
        strokeWidth="0.8"
      />
    </svg>
  );
}

/** The tab that sits on an item card's top edge: gem, rarity word and size. */
export function RarityTab({ rarity, label }: { rarity: Rarity; label: string }) {
  return (
    <span
      className={cn(
        "absolute -top-3 left-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.625rem] font-black tracking-[0.14em] uppercase shadow-[0_4px_12px_-4px_rgb(5_2_20/0.8)]",
        TAB[rarity],
      )}
    >
      <Gem />
      {label}
    </span>
  );
}

/**
 * The item card frame. A rarity-coloured border with a wash of the rarity light across the top
 * and a soft glow beneath; hover or focus within lifts it and brightens the glow.
 */
export function ItemFrame({
  rarity,
  className,
  children,
}: {
  rarity: Rarity;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ "--r": HUE[rarity] } as React.CSSProperties}
      className={cn(
        "relative rounded-2xl border-2 p-4 pt-6 transition-[box-shadow,transform] duration-200 ease-(--ease-out-expo)",
        "bg-[radial-gradient(120%_60%_at_50%_0%,color-mix(in_oklab,var(--r)_24%,transparent),transparent_70%),linear-gradient(180deg,var(--surface-2),var(--surface))]",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_14px_34px_-18px_color-mix(in_oklab,var(--r)_70%,transparent)]",
        "focus-within:-translate-y-1 hover:-translate-y-1 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_20px_44px_-16px_color-mix(in_oklab,var(--r)_90%,transparent)]",
        RARITY_BORDER[rarity],
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Each stat in the block carries its own hue, so a glance tells target from limit from split. */
const STAT_HUES = ["var(--cyan)", "var(--pink)", "var(--violet)", "var(--lime)"];

/** A grid of labelled figures, like an item's stat block. */
export function StatBlock({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-4 gap-1.5">
      {stats.map((s, i) => (
        <div
          key={s.label}
          style={{ "--h": STAT_HUES[i % STAT_HUES.length] } as React.CSSProperties}
          className="rounded-xl border border-[color-mix(in_oklab,var(--h)_35%,transparent)] bg-[color-mix(in_oklab,var(--h)_10%,var(--ink))] px-2 py-1.5"
        >
          <dt className="text-[0.625rem] font-bold tracking-[0.1em] text-(--h) uppercase">
            {s.label}
          </dt>
          <dd className="font-mono tabular text-sm font-semibold">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
