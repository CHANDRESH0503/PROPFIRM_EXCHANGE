import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Buttons meet the 44 px touch target on every size except `sm`, which is only for dense
 * desktop tables. Primary is the brand beam (violet into pink); gold is the Coins action.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition-[background-color,color,box-shadow,transform,filter] duration-150 ease-(--ease-out-expo) outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // The brand beam. Rests on a soft pink-lit shadow and presses down into it.
        primary:
          "bg-beam text-white shadow-[0_8px_22px_-8px_rgb(194_34_119/0.75),inset_0_1px_0_rgb(255_255_255/0.22),inset_0_-2px_0_rgb(0_0_0/0.18)] hover:brightness-110 hover:shadow-[0_12px_28px_-8px_rgb(194_34_119/0.85),inset_0_1px_0_rgb(255_255_255/0.22),inset_0_-2px_0_rgb(0_0_0/0.18)] active:shadow-[0_2px_8px_-2px_rgb(194_34_119/0.7),inset_0_1px_0_rgb(0_0_0/0.18)]",
        // Coins actions: redeem, claim, spend.
        gold: "bg-gold-beam text-ink shadow-[0_8px_22px_-8px_rgb(255_157_46/0.7),inset_0_1px_0_rgb(255_255_255/0.4),inset_0_-2px_0_rgb(0_0_0/0.15)] hover:brightness-105 active:shadow-[0_2px_8px_-2px_rgb(255_157_46/0.6)]",
        secondary:
          "border border-brand/45 bg-brand/12 text-foreground hover:border-brand/80 hover:bg-brand/22",
        ghost: "text-text-soft hover:bg-brand/15 hover:text-foreground",
        danger: "border border-danger/40 bg-danger/12 text-danger hover:bg-danger/22",
        link: "h-auto rounded-none px-0 text-cyan underline decoration-cyan/40 hover:decoration-current",
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

function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  pending = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
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
      <circle
        cx="8"
        cy="8"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <path
        d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export { Button, buttonVariants };
