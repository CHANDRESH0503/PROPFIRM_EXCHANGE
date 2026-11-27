import { cn } from "@/lib/utils";

/**
 * Designed empty state: says what will appear here and offers the next useful action
 * (12-design.md: "empty states point to the next useful action").
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-xl border border-dashed border-hairline px-5 py-6",
        className,
      )}
    >
      {icon ? <div className="text-muted-foreground [&_svg]:size-6">{icon}</div> : null}
      <div className="space-y-1">
        <p className="font-heading text-base font-semibold text-foreground">{title}</p>
        <p className="measure text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
