import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";
import { MotionFade } from "@/components/motion";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Optional secondary action (rendered below the primary). */
  secondaryAction?: ReactNode;
  className?: string;
  /** Tint the icon tile. Defaults to primary/10. */
  iconTone?: "primary" | "brand" | "muted";
}

/**
 * Shared empty state used by Notes, Flashcards, Quizzes, Planner,
 * Documents, Progress, Exam Calendar, Exam Plans, Language, Courses.
 *
 * Centers a tinted icon tile, a title, optional description, and up
 * to two actions. Fades in on mount.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  iconTone = "primary",
}: EmptyStateProps) {
  const toneClass =
    iconTone === "brand"
      ? "bg-brand/10 text-brand"
      : iconTone === "muted"
        ? "bg-muted text-muted-foreground"
        : "bg-primary/10 text-primary";

  return (
    <MotionFade>
      <div
        className={cn(
          "flex flex-col items-center justify-center text-center px-6 py-12 rounded-2xl border border-dashed border-border/70 bg-card/40",
          className,
        )}
      >
        <div
          className={cn(
            "h-16 w-16 rounded-2xl flex items-center justify-center mb-5",
            toneClass,
          )}
        >
          <Icon className="h-8 w-8" strokeWidth={1.6} />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1.5">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm mb-5 leading-relaxed">
            {description}
          </p>
        )}
        {action && <div className="flex flex-col sm:flex-row gap-2.5 items-center">{action}</div>}
        {secondaryAction && <div className="mt-2">{secondaryAction}</div>}
      </div>
    </MotionFade>
  );
}
