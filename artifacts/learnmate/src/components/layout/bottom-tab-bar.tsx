import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Timer, BookOpen, TrendingUp, Bot } from "lucide-react";

const BOTTOM_TAB_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Focus", href: "/tutor", icon: Timer },
  { label: "Notes", href: "/notes", icon: BookOpen },
  { label: "Progress", href: "/progress", icon: TrendingUp },
  { label: "AI", href: "/assistant", icon: Bot },
];

export default function BottomTabBar() {
  const [location] = useLocation();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-card/85 backdrop-blur-xl border-t border-border/60 pb-[env(safe-area-inset-bottom)]"
    >
      <nav className="flex items-stretch justify-around px-2 py-2.5">
        {BOTTOM_TAB_ITEMS.map((item) => {
          const isActive = location === item.href || location.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center gap-1 min-w-[60px] py-1.5"
            >
              {isActive && (
                <motion.span
                  layoutId="bottom-tab-active"
                  className="absolute inset-0 rounded-2xl bg-primary/10"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <motion.span
                animate={{
                  y: isActive ? -1 : 0,
                  color: isActive ? "hsl(217 91% 60%)" : "hsl(215 20% 65%)",
                }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 flex flex-col items-center gap-1"
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-[filter]",
                    isActive && "drop-shadow-[0_0_8px_rgba(37,99,235,0.55)]",
                  )}
                />
                <span className="text-[11px] font-semibold leading-none">{item.label}</span>
              </motion.span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
