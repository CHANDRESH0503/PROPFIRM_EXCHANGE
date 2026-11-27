import * as React from "react";
import { cn } from "@/lib/utils";

/** Native select styled to match Input: best on phones (system picker) and without JavaScript. */
export const selectClass =
  "h-12 w-full appearance-none rounded-xl border border-hairline bg-ink-deep/60 bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2016%2016%22%3E%3Cpath%20d=%22M4%206l4%204%204-4%22%20fill=%22none%22%20stroke=%22%239AA3AF%22%20stroke-width=%221.5%22/%3E%3C/svg%3E')] bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat pr-10 pl-4 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-danger";

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return <select data-slot="select" className={cn(selectClass, className)} {...props} />;
}
