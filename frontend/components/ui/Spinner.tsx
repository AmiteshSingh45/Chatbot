"use client";

import { cn } from "@/lib/utils";

type SpinnerSize = "xs" | "sm" | "md" | "lg";

const sizeMap: Record<SpinnerSize, string> = {
  xs: "h-3 w-3 border",
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-6 w-6 border-2",
};

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

export function Spinner({ size = "sm", className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block rounded-full border-[var(--border-default)] border-t-violet-500 animate-spin",
        sizeMap[size],
        className
      )}
    />
  );
}

export default Spinner;
