import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import {
  useCreateWhopCheckout,
  useVerifyWhopCheckout,
  useListMyPayments,
  getGetSubscriptionQueryKey,
  getListMyPaymentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePremium } from "@/hooks/use-premium";
import { useAvailablePlans } from "@/hooks/use-available-plans";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-url";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { MotionFade } from "@/components/motion";
import {
  Crown,
  Sparkles,
  Wand2,
  GraduationCap,
  Check,
  Clock,
  XCircle,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Receipt,
} from "lucide-react";

const FEATURES = [
  {
    icon: Wand2,
    title: "Smart Notes Maker",
    desc: "Generate, summarize, and solve — powered by AI, right inside your notes.",
  },
  {
    icon: GraduationCap,
    title: "Important Exam Questions",
    desc: "AI-picked likely exam questions with full answers and explanations.",
  },
];

function errMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: { error?: string } | null } | null)?.data;
  return data?.error ?? fallback;
}

export default function PremiumPage() {
  const { status, subscription, isLoadingPremium, isOwner } = usePremium();
  const { data: availablePlans } = useAvailablePlans();
  const yearlyAvailable = availablePlans?.yearly.available !== false;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRenew, setShowRenew] = useState(false);

  const checkout = useCreateWhopCheckout();
  const verify = useVerifyWhopCheckout();
  const [verifying, setVerifying] = useState(
    () => new URLSearchParams(window.location.search).get("whop") === "return",
  );
  const [verifyOutcome, setVerifyOutcome] = useState<"granted" | "notFound" | null>(null);
  const verifyStarted = useRef(false);

  // Coming back from the Whop checkout page: verify the payment server-side.
  useEffect(() => {
    if (!verifying || verifyStarted.current) return;
    verifyStarted.current = true;
    // Clean the URL so a refresh doesn't re-trigger verification.
    window.history.replaceState({}, "", window.location.pathname);

    let attempts = 0;
    const tryVerify = () => {
      attempts += 1;
      verify.mutate(undefined, {
        onSuccess: (d) => {
          if (d.granted || d.alreadyActive) {
            setVerifying(false);
            queryClient.invalidateQueries({ queryKey: getGetSubscriptionQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListMyPaymentsQueryKey() });
            if (d.granted) {
              setVerifyOutcome("granted");
              toast({
                title: "Payment received — Premium is active! 🎉",
                description: "All AI study tools are now unlocked on your account.",
              });
            }
            return;
          }
          // Whop can take a few seconds to record the payment — retry briefly.
          if (attempts < 5) {
            setTimeout(tryVerify, 3000);
          } else {
            setVerifying(false);
            setVerifyOutcome("notFound");
          }
        },
        onError: () => {
          if (attempts < 5) {
            setTimeout(tryVerify, 3000);
          } else {
            setVerifying(false);
            setVerifyOutcome("notFound");
          }
        },
      });
    };
    tryVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifying]);

  const startCardPayment = () => {
    checkout.mutate(undefined, {
      onSuccess: (d) => {
        window.location.href = d.url;
      },
      onError: () => {
        toast({
          title: "Could not start card payment",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
      },
    });
  };

 const [yearlyPending, setYearlyPending] = useState(false);

const startYearlyPayment = async () => {
  setYearlyPending(true);

  try {
    const res = await fetch(apiUrl("/premium/whop/checkout/yearly"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const data = await res.json();

    if (!res.ok) {
      toast({
        title: data.error ?? "Could not start yearly checkout",
        variant: "destructive",
      });
      return;
    }

    if (!data.url) {
      toast({
        title: "Yearly checkout URL was not returned",
        variant: "destructive",
      });
      return;
    }

    window.location.href = data.url;
  } catch (error) {
    console.error("Yearly checkout error:", error);
    toast({
      title: "Could not start yearly checkout",
      description: "Please try again.",
      variant: "destructive",
    });
  } finally {
    setYearlyPending(false);
  }
};   

  const plan = subscription?.plan;
  const days = plan?.days ?? 30;
  const latest = subscription?.latestPayment;

  if (isLoadingPremium) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const isActive = status === "active";

  return (
    <MotionFade className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Hero — navy gradient */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-navy via-[#1e3a6e] to-[#0F172A] p-8 text-white shadow-xl sm:p-12">
        {/* Soft radial blobs */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-[#2563EB]/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-56 w-56 rounded-full bg-[#3B82F6]/10 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 bottom-0 h-40 w-40 rounded-full bg-amber-500/10 blur-2xl" />
        <div className="pointer-events-none absolute -right-10 -top-10 opacity-20">
          <Crown className="h-72 w-72" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" /> Learnova Premium
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            {isActive ? "You're on Premium" : "Study smarter with AI"}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/80">
            {isActive
              ? "Enjoy unlimited access to every AI study tool. Thank you for supporting Learnova."
              : "Unlock AI-powered study tools — $5.99/month (Standard) or $25/year (Plus). Pay once, no auto-renew."}
          </p>
          {isActive && isOwner && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-md">
              <ShieldCheck className="h-4 w-4" />
              Owner account — Premium never expires
            </div>
          )}
          {isActive && !isOwner && subscription?.expiresAt && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-md">
              <ShieldCheck className="h-4 w-4" />
              {(subscription as any).planTier === "yearly" ? "Plus Plan — " : (subscription as any).planTier === "monthly" ? "Standard Plan — " : ""}
              Active until {format(new Date(subscription.expiresAt), "MMMM d, yyyy")}
            </div>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <Card key={f.title} className="glass-card border-border/50">
            <CardContent className="flex gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-purple-500/15 text-primary">
                <f.icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isActive ? (
        <Card className="glass-card border-success/30 bg-success/5">
          <CardContent className="space-y-4 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {isOwner ? "Owner account" : "Premium is active"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isOwner
                    ? "Every Premium feature is unlocked on your account — free, forever."
                    : "All AI study tools are unlocked on your account."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild className="rounded-full">
                <Link href="/notes">
                  Try Smart Notes <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/exam-prep">Open Exam Prep</Link>
              </Button>
              {isOwner ? (
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/admin">
                    <ShieldCheck className="mr-2 h-4 w-4" /> Open Admin Panel
                  </Link>
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => setShowRenew((s) => !s)}
                >
                  {showRenew ? "Hide renew" : "Renew early"}
                </Button>
              )}
            </div>
            {showRenew && !isOwner && (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-5 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Days are added on top of your current expiry — instantly. Choose your plan:
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={startCardPayment}
                    disabled={checkout.isPending || yearlyPending}
                    variant="outline"
                    className="rounded-full border-primary/40 text-primary hover:bg-primary/5"
                    data-testid="button-renew-monthly"
                  >
                    {checkout.isPending ? (
                      <><Spinner className="mr-2 h-4 w-4" /> Opening…</>
                    ) : (
                      <><CreditCard className="mr-2 h-4 w-4" /> Standard — $5.99</>
                    )}
                  </Button>
                  <Button
                    onClick={startYearlyPayment}
                    disabled={checkout.isPending || yearlyPending || !yearlyAvailable}
                    className="rounded-full bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
                    data-testid="button-renew-yearly"
                  >
                    {yearlyPending ? (
                      <><Spinner className="mr-2 h-4 w-4" /> Opening…</>
                    ) : (
                      <><Crown className="mr-2 h-4 w-4" /> Plus — $25 <span className="ml-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">Save 65%</span></>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Secure checkout powered by Whop · No auto-renew</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Status banners */}
          {status === "pending" && latest && (
            <Card className="border-amber-300/50 bg-amber-50/60 dark:bg-amber-500/5">
              <CardContent className="flex items-start gap-3 p-5">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    Payment under review
                  </p>
                  <p className="mt-1 text-amber-800/80 dark:text-amber-300/80">
                    We received your payment reference <strong>{latest.trxId}</strong>. Your
                    Premium will activate as soon as it's verified.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {status === "rejected" && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="flex items-start gap-3 p-5">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="text-sm">
                  <p className="font-semibold text-destructive">Last payment was rejected</p>
                  <p className="mt-1 text-muted-foreground">
                    {latest?.reviewNote
                      ? latest.reviewNote
                      : "Please try paying again, or contact support if the problem continues."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {verifying && (
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="flex items-center gap-3 p-5">
                <Spinner className="h-5 w-5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">Checking your card payment…</p>
                  <p className="mt-1 text-muted-foreground">
                    This takes just a few seconds. Premium unlocks automatically once confirmed.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {verifyOutcome === "notFound" && (
            <Card className="border-destructive/40 bg-destructive/5" data-testid="card-payment-not-confirmed">
              <CardContent className="flex items-start gap-3 p-5">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="text-sm">
                  <p className="font-semibold">Payment not confirmed yet</p>
                  <p className="mt-1 text-muted-foreground">
                    If you completed the card payment, it can take a minute to arrive. Refresh this
                    page shortly — if Premium still doesn't unlock, contact support.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {status === "expired" && (
            <Card className="border-border/60 bg-secondary/30">
              <CardContent className="flex items-start gap-3 p-5">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="text-sm">
                  <p className="font-semibold">Your Premium has expired</p>
                  <p className="mt-1 text-muted-foreground">
                    Renew below to unlock the AI study tools again.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Plan selection */}
          <PlanSelector
            checkoutPending={checkout.isPending}
            verifying={verifying}
            startMonthlyPayment={startCardPayment}
            startYearlyPayment={startYearlyPayment}
            yearlyPending={yearlyPending}
            yearlyAvailable={yearlyAvailable}
          />
        </>
      )}

      {/* Payment history */}
      <PaymentHistory />
    </MotionFade>
  );
}

// ─── Plan Selector ────────────────────────────────────────────────────────────

function PlanSelector({
  checkoutPending,
  verifying,
  startMonthlyPayment,
  startYearlyPayment,
  yearlyPending,
  yearlyAvailable,
}: {
  checkoutPending: boolean;
  verifying: boolean;
  startMonthlyPayment: () => void;
  startYearlyPayment: () => void;
  yearlyPending: boolean;
  yearlyAvailable: boolean;
}) {
  // If yearly is not configured server-side, force selection to monthly
  // and don't let the user pick the unavailable tier.
  const [selected, setSelected] = useState<"monthly" | "yearly">(
    yearlyAvailable ? "monthly" : "monthly",
  );

  const isMonthly = selected === "monthly";
  const isYearly  = selected === "yearly" && yearlyAvailable;
  const pending   = checkoutPending || verifying || yearlyPending;

  return (
    <Card className="glass-card overflow-hidden border-border/50">
      <div className="grid md:grid-cols-2">
        {/* Plan selection */}
        <div className="border-b border-border/50 p-6 sm:p-8 md:border-b-0 md:border-r space-y-4">
          <span className="text-sm font-medium text-muted-foreground">Choose a plan</span>

          {/* Standard (Monthly) */}
          <button
            onClick={() => setSelected("monthly")}
            className={cn(
              "w-full rounded-xl border p-4 text-left transition-all",
              isMonthly
                ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
                : "border-border hover:border-primary/30"
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-extrabold">$5.99</span>
              <span className="text-sm text-muted-foreground">/ month</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Standard Access · 30 days · no auto-renew</p>
          </button>

          {/* Plus (Yearly) — hidden when the server doesn't have WHOP_YEARLY_PLAN_ID set */}
          {yearlyAvailable ? (
          <button
            onClick={() => setSelected("yearly")}
            className={cn(
              "w-full rounded-xl border p-4 text-left transition-all relative",
              isYearly
                ? "border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/30"
                : "border-border hover:border-amber-500/30"
            )}
          >
            <span className="absolute -top-2.5 right-3 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
              Best Value — Save 65%
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-extrabold">$25</span>
              <span className="text-sm text-muted-foreground">/ year</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Plus Access · 365 days · no auto-renew</p>
          </button>
          ) : (
            <div
              className="w-full rounded-xl border border-dashed border-border p-4 text-left"
              data-testid="card-yearly-unavailable"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold text-muted-foreground">Plus (Yearly)</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Coming soon</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                The yearly plan isn't available yet. Use the Standard plan above — the owner is working on it.
              </p>
            </div>
          )}

          {/* Features comparison */}
          <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-2 text-xs">
            <div>
              <span className="font-semibold text-foreground">Standard ($5.99):</span>{" "}
              <span className="text-muted-foreground">Smart Notes · AI Quizzes · Exam Prep · 7 lessons/course</span>
            </div>
            <div>
              <span className="font-semibold text-amber-600 dark:text-amber-400">Plus ($25):</span>{" "}
              <span className="text-muted-foreground">Everything + AI Routine · 14 lessons/course · Unlimited AI</span>
            </div>
          </div>

          <ul className="space-y-2 text-sm pt-1">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> {f.title}
              </li>
            ))}
            <li className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> Cancel anytime — no auto-renew
            </li>
          </ul>
        </div>

        {/* Payment */}
        <div className="p-6 sm:p-8 flex flex-col justify-center">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 mb-4">
            <h3 className="flex items-center gap-2 text-base font-semibold mb-1">
              <CreditCard className="h-4 w-4 text-primary" /> Pay with card
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Visa, Mastercard & more — instant activation, no waiting.
            </p>
            <Button
              onClick={isMonthly ? startMonthlyPayment : startYearlyPayment}
              disabled={pending}
              className="w-full rounded-full"
              data-testid="button-pay-card"
            >
              {pending ? (
                <><Spinner className="mr-2 h-4 w-4" /> Opening secure checkout…</>
              ) : isMonthly ? (
                <><CreditCard className="mr-2 h-4 w-4" /> Pay $5.99 — Standard</>
              ) : (
                <><CreditCard className="mr-2 h-4 w-4" /> Pay $25 — Plus</>
              )}
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Secure checkout powered by Whop
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {isMonthly
              ? "Standard: Pay once and Premium unlocks instantly for 30 days."
              : "Plus: Pay once and Premium unlocks instantly for 365 days (1 year)."}
            {" "}Your payment is handled on a secure checkout page, and you'll be brought right back here.
          </p>
        </div>
      </div>
    </Card>
  );
}

const STATUS_BADGE: Record<
  string,
  { label: string; className: string; icon: typeof Check }
> = {
  pending: {
    label: "Pending",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    icon: Check,
  },
  rejected: {
    label: "Rejected",
    className:
      "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
    icon: XCircle,
  },
};

function PaymentHistory() {
  const { data: payments, isLoading } = useListMyPayments();

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-2xl" />;
  }
  if (!payments || payments.length === 0) return null;

  return (
    <Card className="glass-card border-border/50">
      <CardContent className="p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Payment history</h3>
        </div>
        <ul className="divide-y divide-border/60">
          {payments.map((p) => {
            const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.pending;
            const BadgeIcon = badge.icon;
            return (
              <li key={p.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-semibold tracking-wide">
                        {p.trxId}
                      </p>
                      {p.plan === "premium_yearly" ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          Yearly · $25
                        </span>
                      ) : p.senderNumber === "card" || p.plan ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Monthly · $5.99
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {format(new Date(p.createdAt), "MMMM d, yyyy • h:mm a")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                    >
                      <BadgeIcon className="h-3 w-3" /> {badge.label}
                    </span>
                  </div>
                </div>
                {p.status === "rejected" && p.reviewNote && (
                  <p className="mt-2 rounded-lg bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {p.reviewNote}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
