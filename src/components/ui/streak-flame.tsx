import { cn } from "@/lib/utils";

/** Streak flame. Unlit (outline, muted) until the first check-in; lit is paper-white, not a state colour. */
export function StreakFlame({ lit, className }: { lit: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", lit ? "text-foreground" : "text-muted-foreground", className)} aria-hidden="true">
      <path
        d="M12 2.75c.6 3.1-1.9 4.6-3.4 6.6A6.9 6.9 0 0 0 7 13.6 5 5 0 0 0 12 21.25a5.1 5.1 0 0 0 5-5.2c0-2.3-1.2-3.7-2.1-4.9-.3 1.3-1 2.2-2 2.6.6-3.4-.2-7-0.9-10.8Z"
        fill={lit ? "currentColor" : "none"}
        fillOpacity={lit ? 0.9 : 0}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
