import Link from "next/link";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/** Text wordmark until the final name and logo exist (CLAUDE.md §7). */
export function Wordmark({ href = "/", className }: { href?: "/" | "/today" | "/admin"; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex min-h-11 items-center font-heading text-lg font-bold tracking-[-0.02em] text-foreground", className)}
    >
      {brand.name}
    </Link>
  );
}
