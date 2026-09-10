import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Tailwind height class. Defaults to `h-4`. */
  h?: string;
  /** Tailwind width class. Defaults to `w-full`. */
  w?: string;
  /** Rounded corners size. Defaults to `rounded-md`. */
  rounded?: "sm" | "md" | "lg" | "xl" | "full";
}

/**
 * Animated skeleton with a soft shimmer effect.
 * Drop-in replacement for shadcn's static `Skeleton`.
 */
export default function Skeleton({ h = "h-4", w = "w-full", rounded = "md", className, ...rest }: SkeletonProps) {
  const radiusMap = {
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    full: "rounded-full",
  } as const;
  return (
    <div
      className={cn("shimmer", h, w, radiusMap[rounded], className)}
      aria-hidden="true"
      {...rest}
    />
  );
}
