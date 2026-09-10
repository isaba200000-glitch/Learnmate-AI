import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Brain, LogOut, ShieldCheck } from "lucide-react";
import { useUser, useClerk } from "@clerk/react";
import { NAV_SECTIONS } from "./nav-items";
import { SidebarPremiumCard } from "@/components/premium/premium-status";
import { usePremium } from "@/hooks/use-premium";

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isOwner } = usePremium();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar/80 backdrop-blur-2xl lg:flex z-10 relative">
      {/* Brand mark — navy gradient anchors the sidebar */}
      <div className="flex h-16 items-center px-5 border-b border-border/40">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand via-brand-deep to-primary text-white shadow-[0_4px_16px_rgba(30,58,138,0.35)] transition-transform group-hover:scale-105">
            <Brain className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Learnova <span className="text-primary">AI</span>
          </span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 scrollbar-hide">
        <nav className="space-y-1">
          {NAV_SECTIONS.map((section, si) => (
            <div key={si}>
              {section.label && (
                <div className="mx-1 mb-1.5 mt-5 flex items-center gap-2">
                  <span className="h-px flex-1 bg-border/60" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                    {section.label}
                  </span>
                  <span className="h-px flex-1 bg-border/60" />
                </div>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location === item.href || location.startsWith(item.href + "/");
                  return (
                    <li key={item.href} className="relative">
                      {isActive && (
                        <motion.span
                          layoutId="sidebar-active-indicator"
                          className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-gradient-to-b from-primary to-brand-deep"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      )}
                      <Link
                        href={item.href}
                        className={cn(
                          "relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all duration-200 group",
                          isActive
                            ? "bg-primary/10 text-foreground"
                            : "text-sidebar-foreground/70 hover:bg-muted/60 hover:text-sidebar-foreground",
                        )}
                      >
                        <div
                          className={cn(
                            "icon-tile rounded-xl h-10 w-10 shrink-0 text-white",
                            item.iconColor,
                            "transition-shadow",
                            isActive && "shadow-[0_0_18px_rgba(37,99,235,0.45)]",
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="text-[13px] font-semibold leading-none">{item.label}</span>
                          <span className="text-[11px] text-muted-foreground leading-none truncate">
                            {item.description}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {isOwner && (
            <>
              <div className="mx-1 mb-1.5 mt-5 flex items-center gap-2">
                <span className="h-px flex-1 bg-border/60" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  Owner
                </span>
                <span className="h-px flex-1 bg-border/60" />
              </div>
              <OwnerLink active={location === "/admin"} href="/admin" />
            </>
          )}
        </nav>
      </div>

      <div className="border-t border-border/40 p-4 space-y-3">
        <SidebarPremiumCard />
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 backdrop-blur-sm p-2.5 transition-all hover:bg-muted/70 hover:border-border"
        >
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-brand to-brand-deep ring-2 ring-primary/30">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt={user.fullName || "User"} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white font-semibold text-sm">
                {user?.firstName?.charAt(0) || "U"}
              </div>
            )}
          </div>
          <div className="flex flex-col overflow-hidden flex-1 min-w-0">
            <span className="truncate text-sm font-semibold leading-none">{user?.fullName || "Student"}</span>
            <span className="truncate text-xs text-muted-foreground mt-1.5">
              {user?.primaryEmailAddress?.emailAddress}
            </span>
          </div>
        </Link>
        <button
          onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL || "/" })}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

function OwnerLink({ active, href }: { active: boolean; href: string }) {
  return (
    <li className="relative">
      {active && (
        <motion.span
          layoutId="sidebar-active-indicator"
          className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-gradient-to-b from-primary to-brand-deep"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      <Link
        href={href}
        className={cn(
          "relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all",
          active
            ? "bg-primary/10 text-foreground"
            : "text-sidebar-foreground/70 hover:bg-muted/60",
        )}
      >
        <div
          className={cn(
            "icon-tile rounded-xl h-10 w-10 shrink-0 text-white bg-slate-600",
            active && "shadow-[0_0_18px_rgba(37,99,235,0.45)]",
          )}
        >
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-[13px] font-semibold leading-none">Admin Panel</span>
          <span className="text-[11px] text-muted-foreground leading-none truncate">Owner dashboard</span>
        </div>
      </Link>
    </li>
  );
}
