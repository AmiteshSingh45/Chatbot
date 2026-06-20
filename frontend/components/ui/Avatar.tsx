"use client";

import { cn } from "@/lib/utils";

type AvatarSize = "xs" | "sm" | "md" | "lg";
type AvatarVariant = "gradient" | "surface" | "ai";

interface AvatarProps {
  initials?: string;
  icon?: React.ReactNode;
  size?: AvatarSize;
  variant?: AvatarVariant;
  className?: string;
  "aria-label"?: string;
}

const sizeMap: Record<AvatarSize, string> = {
  xs: "w-6 h-6 text-[10px] rounded-lg",
  sm: "w-8 h-8 text-xs rounded-xl",
  md: "w-10 h-10 text-sm rounded-2xl",
  lg: "w-12 h-12 text-base rounded-2xl",
};

const variantMap: Record<AvatarVariant, string> = {
  gradient:
    "bg-gradient-to-br from-violet-600 to-indigo-500 text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]",
  surface:
    "bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-secondary)]",
  ai:
    "bg-gradient-to-br from-violet-600/20 to-sky-500/20 border border-violet-500/20 text-[var(--text-primary)]",
};

export function Avatar({
  initials,
  icon,
  size = "sm",
  variant = "gradient",
  className,
  "aria-label": ariaLabel,
}: AvatarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center font-bold flex-shrink-0 select-none",
        sizeMap[size],
        variantMap[variant],
        className
      )}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    >
      {icon ?? initials}
    </div>
  );
}

export default Avatar;
