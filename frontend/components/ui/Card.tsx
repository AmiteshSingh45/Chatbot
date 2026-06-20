"use client";

import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  noPadding?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ elevated = false, noPadding = false, children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border transition-all duration-200",
          elevated
            ? "bg-[var(--bg-elevated)] border-[var(--border-default)] shadow-[var(--shadow-md)]"
            : "bg-[var(--bg-tertiary)] border-[var(--border-subtle)] shadow-[var(--shadow-sm)]",
          !noPadding && "p-5",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}

export function CardHeader({
  icon,
  title,
  description,
  className,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn("flex items-center gap-3 mb-5", className)}
      {...props}
    >
      {icon && (
        <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/15 flex-shrink-0">
          <div className="text-violet-400">{icon}</div>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        {description && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

export default Card;
