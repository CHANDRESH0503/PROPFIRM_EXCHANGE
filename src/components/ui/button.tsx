import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Buttons meet the 44 px touch target on every size except `sm`, which is only for dense
 * desktop tables. Primary is paper on ink: colour is reserved for meaning (gold = Coins).
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-150 ease-(--ease-out-expo) outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklab,var(--text)_88%,var(--ink))]",
        secondary: "border border-hairline bg-surface text-foreground hover:bg-raised",
        ghost: "text-text-soft hover:bg-raised hover:text-foreground",
        danger: "bg-danger/15 text-danger hover:bg-danger/25",
        link: "h-auto px-0 text-foreground underline decoration-hairline hover:decoration-current",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-[0.9375rem]",
        lg: "h-12 px-5 text-base",
        icon: "size-11",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a busy state and blocks repeat submits. */
    pending?: boolean;
  };

function Button({ className, variant, size, block, asChild = false, pending = false, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={asChild ? undefined : disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {pending ? <Spinner /> : null}
          {children}
        </>
      )}
    </Comp>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 animate-spin" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export { Button, buttonVariants };
