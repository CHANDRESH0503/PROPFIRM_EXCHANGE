import { useId } from "react";
import { cn } from "@/lib/utils";

/** Streak flame. Unlit (outline, muted) until the day's check-in; lit burns pink into gold. */
export function StreakFlame({ lit, className }: { lit: boolean; className?: string }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(
        "size-6",
        lit ? "drop-shadow-[0_4px_12px_rgb(255_95_174/0.65)]" : "text-muted-foreground",
        className,
      )}
      aria-hidden="true"
    >
      {lit ? (
        <defs>
          <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="var(--gold)" />
            <stop offset="0.55" stopColor="var(--legendary)" />
            <stop offset="1" stopColor="var(--pink)" />
          </linearGradient>
        </defs>
      ) : null}
      <path
        d="M12 2.75c.6 3.1-1.9 4.6-3.4 6.6A6.9 6.9 0 0 0 7 13.6 5 5 0 0 0 12 21.25a5.1 5.1 0 0 0 5-5.2c0-2.3-1.2-3.7-2.1-4.9-.3 1.3-1 2.2-2 2.6.6-3.4-.2-7-0.9-10.8Z"
        fill={lit ? `url(#${id})` : "none"}
        stroke={lit ? "none" : "currentColor"}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {lit ? (
        <path
          d="M12 13.2c.9 1.3 2.2 2.1 2.2 3.6a2.2 2.2 0 0 1-4.4 0c0-1 .6-1.6 1.2-2.3.5-.4.9-.8 1-1.3Z"
          fill="#fff6d6"
        />
      ) : null}
    </svg>
  );
}
