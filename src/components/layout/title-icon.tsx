import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The coloured tile that leads a page title. Each area of the product owns a hue (Today violet,
 * Deals pink, Rewards gold, Accounts cyan, Profile mint), so the tile tells you where you are.
 */
export function TitleIcon({
  icon: Icon,
  hue,
  className,
}: {
  icon: LucideIcon;
  hue: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ "--h": hue } as React.CSSProperties}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-2xl border border-[color-mix(in_oklab,var(--h)_55%,transparent)] bg-[color-mix(in_oklab,var(--h)_20%,var(--ink))] text-(--h) shadow-[0_8px_20px_-8px_var(--h)]",
        className,
      )}
    >
      <Icon className="size-[1.375rem]" strokeWidth={2.25} />
    </span>
  );
}
