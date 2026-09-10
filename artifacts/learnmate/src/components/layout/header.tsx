import { useEffect, useRef, useState } from "react";
import { Bell, Menu, Sparkles, Coins } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useGetProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import MobileNav from "./mobile-nav";
import GlobalSearch from "./global-search";

export default function Header() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef(false);

  const { data: profile } = useGetProfile({
    query: { queryKey: getGetProfileQueryKey(), retry: false },
  });

  useEffect(() => {
    const onScroll = () => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      rafRef.current = window.requestAnimationFrame(() => {
        pendingRef.current = false;
        setScrolled(window.scrollY > 4);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <motion.header
      animate={{
        boxShadow: scrolled
          ? "0 6px 24px -8px rgba(0, 0, 0, 0.4)"
          : "0 0 0 0 rgba(0, 0, 0, 0)",
        borderColor: scrolled ? "hsl(217 33% 18%)" : "hsl(217 33% 20%)",
      }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-40 flex h-16 w-full items-center justify-between gap-2 border-b bg-background/75 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sm:px-6"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden h-11 w-11 min-h-[44px] min-w-[44px]"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <GlobalSearch />
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        {profile && (
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 rounded-full glass-card border border-border/60">
            <motion.div
              className="flex items-center gap-2 text-sm font-semibold"
              whileTap={{ scale: 0.96 }}
            >
              <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)] animate-pulse" />
              <span className="font-mono">{profile.streak}</span>
            </motion.div>
            <div className="w-px h-4 bg-border" />
            <motion.div
              className="flex items-center gap-2 text-sm font-semibold"
              whileTap={{ scale: 0.96 }}
            >
              <Coins className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono">{profile.coins}</span>
            </motion.div>
          </div>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-secondary/80 h-11 w-11 min-h-[44px] min-w-[44px]"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <p className="mb-1 text-sm font-semibold">Notifications</p>
            <div className="py-6 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-8 w-8 opacity-30" />
              You're all caught up!
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </motion.header>
  );
}
