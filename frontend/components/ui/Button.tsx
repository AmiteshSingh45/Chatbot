"use client";

import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-500 text-white font-semibold shadow-[0_0_20px_rgba(139,92,246,0.25)] hover:shadow-[0_0_28px_rgba(139,92,246,0.35)] hover:opacity-90 active:opacity-80 active:scale-[0.98] disabled:opacity-35 disabled:cursor-not-allowed disabled:shadow-none",
  secondary:
    "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-overlay)] hover:border-[var(--border-strong)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed",
  ghost:
    "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] active:bg-[var(--bg-active)] disabled:opacity-40 disabled:cursor-not-allowed",
  danger:
    "bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/18 hover:border-rose-500/40 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed",
  outline:
    "bg-transparent text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "px-2.5 py-1 text-xs rounded-lg gap-1",
  sm: "px-3 py-1.5 text-xs rounded-xl gap-1.5",
  md: "px-4 py-2 text-sm rounded-xl gap-2",
  lg: "px-5 py-2.5 text-sm rounded-2xl gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      loading = false,
      iconLeft,
      iconRight,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-150 ease-out select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <span
            className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin flex-shrink-0"
            aria-hidden
          />
        ) : iconLeft ? (
          <span className="flex-shrink-0">{iconLeft}</span>
        ) : null}
        {children && <span className="truncate">{children}</span>}
        {!loading && iconRight && (
          <span className="flex-shrink-0">{iconRight}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
