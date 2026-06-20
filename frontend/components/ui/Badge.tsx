"use client";

import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "custom";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  icon?: React.ReactNode;
  color?: string; // custom hex for agent badges
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-violet-500/12 text-violet-300 border-violet-500/20",
  success:
    "bg-emerald-500/12 text-emerald-400 border-emerald-500/20",
  warning:
    "bg-amber-500/12 text-amber-400 border-amber-500/20",
  danger:
    "bg-rose-500/12 text-rose-400 border-rose-500/20",
  info:
    "bg-sky-500/12 text-sky-400 border-sky-500/20",
  custom: "", // handled by color prop
};

export function Badge({
  children,
  variant = "default",
  dot,
  icon,
  color,
  className,
}: BadgeProps) {
  const isCustom = variant === "custom" && color;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border leading-none",
        !isCustom && variantStyles[variant],
        className
      )}
      style={
        isCustom
          ? {
              background: `${color}15`,
              color,
              borderColor: `${color}30`,
            }
          : undefined
      }
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={isCustom ? { background: color } : undefined}
          aria-hidden
        />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

export default Badge;
