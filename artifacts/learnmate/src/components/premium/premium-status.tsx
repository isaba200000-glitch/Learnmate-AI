import { Link } from "wouter";
import { Crown, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { usePremium } from "@/hooks/use-premium";

/** Small gold "Premium" pill. */
export function PremiumBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 shadow-sm",
        className,
      )}
    >
      <Crown className="h-3 w-3" /> Premium
    </span>
  );
}

/** Sidebar block: shows premium status, or an upgrade CTA for free users. */
export function SidebarPremiumCard({ onNavigate }: { onNavigate?: () => void }) {
  const { isPremium, isOwner, subscription, isLoadingPremium } = usePremium();

  if (isLoadingPremium) return null;

  if (isPremium) {
    return (
      <Link
        href="/premium"
        onClick={onNavigate}
        className="mb-2 flex items-center gap-3 rounded-xl border border-amber-300/40 bg-gradient-to-br from-amber-50 to-yellow-100 p-3 transition-all hover:shadow-md dark:from-amber-500/10 dark:to-yellow-500/10"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 text-amber-950 shadow-sm">
          <Crown className="h-5 w-5" />
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="text-sm font-semibold leading-none text-amber-900 dark:text-amber-200">
            {isOwner ? "Owner account" : "Premium active"}
          </span>
          {isOwner ? (
            <span className="mt-1 truncate text-xs text-amber-700/80 dark:text-amber-300/70">
              Full access forever
            </span>
          ) : (
            subscription?.expiresAt && (
              <span className="mt-1 truncate text-xs text-amber-700/80 dark:text-amber-300/70">
                Until {format(new Date(subscription.expiresAt), "MMM d, yyyy")}
              </span>
            )
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href="/premium"
      onClick={onNavigate}
      className="mb-2 flex items-center gap-3 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-purple-500/10 p-3 transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="flex flex-col overflow-hidden">
        <span className="text-sm font-semibold leading-none">Go Premium</span>
        <span className="mt-1 truncate text-xs text-muted-foreground">
          Unlock AI notes & exam prep
        </span>
      </div>
    </Link>
  );
}
