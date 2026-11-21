import * as React from "react";
import { cn } from "@/lib/utils";

/** 48 px tall, 16 px text (no iOS zoom on focus), invalid state from aria-invalid. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-lg border border-hairline bg-surface px-4 text-base text-foreground transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-muted-foreground hover:border-[color-mix(in_oklab,var(--hairline)_60%,var(--text))] focus-visible:border-[color-mix(in_oklab,var(--hairline)_30%,var(--text))] focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/25",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
