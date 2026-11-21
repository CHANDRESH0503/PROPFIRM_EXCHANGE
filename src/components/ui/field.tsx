import { cn } from "@/lib/utils";

/**
 * Label + control + hint + error, wired for assistive tech: the error is announced
 * (aria-live) and linked to the control through aria-describedby by the caller via `ids`.
 */
export function fieldIds(name: string) {
  return { hint: `${name}-hint`, error: `${name}-error` };
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ids = fieldIds(htmlFor);
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-text-soft">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={ids.hint} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <p id={ids.error} aria-live="polite" className={cn("text-sm text-danger", !error && "sr-only")}>
        {error ?? ""}
      </p>
    </div>
  );
}
