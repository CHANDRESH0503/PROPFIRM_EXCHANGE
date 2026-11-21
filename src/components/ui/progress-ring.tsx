import { cn } from "@/lib/utils";

type Tone = "gold" | "positive" | "caution" | "danger" | "neutral";

const toneColor: Record<Tone, string> = {
  gold: "var(--gold)",
  positive: "var(--positive)",
  caution: "var(--caution)",
  danger: "var(--danger)",
  neutral: "var(--text)",
};

/**
 * Progress ring for levels (gold) and Guardian risk rings (positive → caution → danger).
 * The fill animates on mount through a CSS transition; reduced-motion users get it instantly.
 * `label` is the accessible name; the visible centre content is children.
 */
export function ProgressRing({
  value,
  max = 100,
  size = 96,
  stroke = 8,
  tone = "gold",
  label,
  children,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  label: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(value, max));
  const ratio = max > 0 ? clamped / max : 0;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hairline)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={toneColor[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-700 ease-(--ease-out-expo) starting:[stroke-dashoffset:var(--c)]"
          style={{ ["--c" as string]: circumference }}
          opacity={ratio === 0 ? 0 : 1}
        />
      </svg>
      {children ? <div className="absolute inset-0 grid place-items-center text-center">{children}</div> : null}
    </div>
  );
}
