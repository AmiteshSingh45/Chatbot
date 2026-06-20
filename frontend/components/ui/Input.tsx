"use client";

import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, iconLeft, iconRight, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-[var(--text-secondary)]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {iconLeft && (
            <span className="absolute left-3 text-[var(--text-muted)] pointer-events-none flex-shrink-0">
              {iconLeft}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm rounded-xl border outline-none transition-all duration-150",
              "placeholder:text-[var(--text-muted)] placeholder:text-xs",
              "focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 focus-visible:outline-none",
              error
                ? "border-rose-500/50 focus:border-rose-500/60 focus:ring-rose-500/10"
                : "border-[var(--border-subtle)]",
              iconLeft ? "pl-9 pr-3 py-2" : "px-3 py-2",
              iconRight ? "pr-9" : "",
              className
            )}
            {...props}
          />
          {iconRight && (
            <span className="absolute right-3 text-[var(--text-muted)] flex-shrink-0">
              {iconRight}
            </span>
          )}
        </div>
        {(error || hint) && (
          <p
            className={cn(
              "text-xs",
              error ? "text-rose-400" : "text-[var(--text-muted)]"
            )}
          >
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
