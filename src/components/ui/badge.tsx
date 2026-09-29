import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Status colours are the same everywhere:
 * success = clean, ready, paid · warning = pending, dirty
 * danger = out of order, overdue, error · info = in house, information
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[13px] font-medium",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        brand: "border-transparent bg-primary-soft text-primary-strong",
        neutral: "border-transparent bg-muted text-muted-foreground",
        success: "border-transparent bg-success-soft text-success-strong",
        warning: "border-transparent bg-warning-soft text-warning-strong",
        danger: "border-transparent bg-danger-soft text-danger-strong",
        info: "border-transparent bg-info-soft text-info-strong",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-danger-soft text-danger-strong",
        outline: "text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

const dotColour: Record<string, string> = {
  success: "bg-success", warning: "bg-warning", danger: "bg-destructive", destructive: "bg-destructive",
  info: "bg-info", brand: "bg-primary", neutral: "bg-muted-foreground",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className={cn("size-2 shrink-0 rounded-full", dotColour[variant ?? ""] ?? "bg-current")} aria-hidden />}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
