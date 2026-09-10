import { type ReactNode } from "react";
import { Link } from "wouter";
import { Lock, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PremiumGateProps {
  title?: string;
  description?: string;
  features?: string[];
  className?: string;
  children?: ReactNode;
}

/** Locked panel shown where a premium-only feature would appear for free users. */
export function PremiumGate({
  title = "This is a Premium feature",
  description = "Upgrade to Learnova Premium to unlock AI-powered study tools.",
  features,
  className,
  children,
}: PremiumGateProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-50/80 to-yellow-100/50 p-8 text-center dark:from-amber-500/10 dark:to-yellow-500/5",
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 opacity-10">
        <Crown className="h-40 w-40 text-amber-500" />
      </div>
      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-amber-950 shadow-md">
          <Lock className="h-7 w-7" />
        </div>
        <h3 className="text-xl font-bold tracking-tight">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>

        {features && features.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-left text-sm">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}

        {children}

        <Button
          asChild
          className="mt-6 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-6 font-semibold text-amber-950 hover:from-amber-500 hover:to-yellow-600"
        >
          <Link href="/premium">
            <Crown className="mr-2 h-4 w-4" /> Upgrade to Premium
          </Link>
        </Button>
      </div>
    </div>
  );
}
