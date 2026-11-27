import Link from "next/link";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/**
 * Text wordmark until the final name and logo exist (CLAUDE.md §7). Pages a signed-in member can
 * reach use SessionWordmark (components/layout/session-links), which points at Today instead of
 * the landing page; the signed-in shell and admin pass their own href.
 */
export function Wordmark({
  href,
  className,
}: {
  href: "/" | "/today" | "/admin";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 font-heading text-lg font-extrabold tracking-[-0.02em] text-foreground [font-stretch:110%]",
        className,
      )}
    >
      <BrandMark />
      <span className="max-[420px]:sr-only">{brand.name}</span>
    </Link>
  );
}

/** Placeholder mark until the owner's logo exists: a Coin with a "comes back" arrow around it. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0 drop-shadow-[0_4px_10px_rgb(194_34_119/0.55)]", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fb-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand)" />
          <stop offset="1" stopColor="var(--brand-2)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#fb-mark)" />
      <path
        d="M24.5 16a8.5 8.5 0 1 1-2.5-6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M22.9 5.6 23.4 10.9 18.2 10.6Z" fill="#fff" />
      <circle cx="16" cy="16" r="3.6" fill="var(--gold)" />
    </svg>
  );
}
