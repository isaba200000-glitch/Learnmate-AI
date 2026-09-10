import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { Brain, LogOut, ShieldCheck } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "./nav-items";
import { SidebarPremiumCard } from "@/components/premium/premium-status";
import { usePremium } from "@/hooks/use-premium";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isOwner } = usePremium();

  const navLink = (href: string, label: string, Icon: React.ElementType) => {
    const isActive = location === href || location.startsWith(href + "/");
    return (
      <Link
        key={href}
        href={href}
        onClick={() => onOpenChange(false)}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all",
          isActive
            ? "bg-primary/20 text-primary shadow-[0_0_16px_rgba(59,130,246,0.2)]"
            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
        )}
      >
        <div className={cn(
          "icon-tile rounded-lg h-8 w-8 shrink-0",
          isActive 
            ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(59,130,246,0.4)]" 
            : "bg-secondary/60 text-muted-foreground"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="flex-1 leading-tight">{label}</span>
      </Link>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-72 flex-col gap-0 p-0 dark:bg-sidebar/90 dark:backdrop-blur-2xl">
        <SheetHeader className="border-b border-border/50 dark:border-white/[0.08] px-6 py-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_0_16px_rgba(59,130,246,0.4)]">
              <Brain className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Learnova <span className="font-black text-primary">AI</span>
            </span>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} className={si > 0 ? "mt-2" : ""}>
              {section.label && (
                <div className="mx-1 mb-2 mt-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-2">
                    {section.label}
                  </span>
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => navLink(item.href, item.label, item.icon))}
              </div>
            </div>
          ))}

          {isOwner && (
            <div className="mt-2">
              <div className="mx-1 mb-2 mt-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-2">
                  Owner
                </span>
              </div>
              <Link
                href="/admin"
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all",
                  location === "/admin"
                    ? "bg-primary/20 text-primary shadow-[0_0_16px_rgba(59,130,246,0.2)]"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <div className={cn(
                  "icon-tile rounded-lg h-8 w-8 shrink-0",
                  location === "/admin" 
                    ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(59,130,246,0.4)]" 
                    : "bg-secondary/60 text-muted-foreground"
                )}>
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <span className="flex-1 leading-tight">Admin Panel</span>
              </Link>
            </div>
          )}
        </nav>

        <div className="border-t border-border/50 dark:border-white/[0.08] p-4">
          <SidebarPremiumCard onNavigate={() => onOpenChange(false)} />
          <Link
            href="/profile"
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-3 rounded-xl border p-2 transition-all dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.08] hover:border-border/50 hover:bg-secondary/50"
          >
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-blue-600 ring-2 ring-primary/20">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt={user.fullName || "User"} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-white font-medium">
                  {user?.firstName?.charAt(0) || "U"}
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium leading-none">{user?.fullName || "Student"}</span>
              <span className="mt-1 truncate text-xs text-muted-foreground">
                {user?.primaryEmailAddress?.emailAddress}
              </span>
            </div>
          </Link>
          <button
            onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL || "/" })}
            className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
