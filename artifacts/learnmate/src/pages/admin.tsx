import { memo, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminLogin,
  checkAdminSession,
  listAdminPayments,
  listAdminUsers,
  setUserPremium,
  getAdminStats,
  getAdminSettings,
  updateAdminSettings,
  type AdminUser,
  type AdminSettings,
} from "@workspace/api-client-react";
import {
  getAdminToken,
  setAdminToken,
  clearAdminToken,
  adminOptions,
  isUnauthorized,
} from "@/lib/admin-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Brain,
  LogOut,
  Lock,
  Check,
  Crown,
  Search,
  ShieldCheck,
  Clock,
  RefreshCw,
  Wallet,
  CalendarDays,
  Hourglass,
  Settings,
} from "lucide-react";

function errMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: { error?: string } | null } | null)?.data;
  return data?.error ?? fallback;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  rejected: "bg-destructive/10 text-destructive",
};

/* ------------------------------------------------------------------ */
/* Stats cards                                                         */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  accent,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  loading: boolean;
  accent: string;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-1 h-6 w-16" />
          ) : (
            <p className="truncate text-xl font-bold tracking-tight">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatsCards({ onAuthError }: { onAuthError: () => void }) {
  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => getAdminStats(adminOptions()),
  });

  useEffect(() => {
    if (isUnauthorized(statsQuery.error)) onAuthError();
  }, [statsQuery.error, onAuthError]);

  const s = statsQuery.data;
  const loading = statsQuery.isLoading;
  const tk = (n: number) => `Tk ${n.toLocaleString()}`;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        icon={Wallet}
        label="Total earnings"
        value={tk(s?.totalEarnings ?? 0)}
        loading={loading}
        accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
      />
      <StatCard
        icon={CalendarDays}
        label="This month"
        value={tk(s?.monthEarnings ?? 0)}
        loading={loading}
        accent="bg-primary/10 text-primary"
      />
      <StatCard
        icon={Hourglass}
        label="Pending payments"
        value={String(s?.pendingPayments ?? 0)}
        loading={loading}
        accent="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
      />
      <StatCard
        icon={Crown}
        label="Active Premium"
        value={String(s?.activePremiumStudents ?? 0)}
        loading={loading}
        accent="bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Login screen                                                        */
/* ------------------------------------------------------------------ */

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: (pwd: string) => adminLogin({ password: pwd }),
    onSuccess: (session) => {
      setAdminToken(session.token);
      onSuccess();
    },
    onError: (err) =>
      toast({
        title: "Login failed",
        description: errMessage(err, "Incorrect password."),
        variant: "destructive",
      }),
  });

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      <Card className="w-full max-w-sm glass-card border-border/50">
        <CardContent className="p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <Lock className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Learnova <span className="font-black text-primary">AI</span>
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (password.trim()) login.mutate(password);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={login.isPending} className="w-full gap-2 rounded-xl">
              {login.isPending ? (
                <>
                  <Spinner className="h-4 w-4" /> Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payments tab                                                        */
/* ------------------------------------------------------------------ */

function PaymentsTab({ onAuthError }: { onAuthError: () => void }) {
  const paymentsQuery = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: () => listAdminPayments(undefined, adminOptions()),
  });

  useEffect(() => {
    if (isUnauthorized(paymentsQuery.error)) onAuthError();
  }, [paymentsQuery.error, onAuthError]);

  // Card payments only — bKash was removed from the app; payments are
  // verified and approved automatically, nothing to review by hand.
  const payments = (paymentsQuery.data ?? []).filter((p) => p.senderNumber === "card");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Students pay <strong>$5.99 by card</strong> (via Whop). Payments are verified and
          Premium activates automatically — this is just your payment history.
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5"
          onClick={() => paymentsQuery.refetch()}
          disabled={paymentsQuery.isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${paymentsQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {paymentsQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 py-16 text-center text-muted-foreground">
          No card payments yet.
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <Card key={p.id} className="border-border/50">
              <CardContent className="flex flex-col gap-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{p.userName || "Unknown user"}</span>
                  <Badge className={`${STATUS_STYLES[p.status]} border-none capitalize`}>
                    {p.status}
                  </Badge>
                  <span className="font-medium text-primary">💳 Card payment (Whop · $5.99)</span>
                </div>
                <p className="truncate text-sm text-muted-foreground">{p.userEmail}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>
                    Receipt: <span className="font-mono font-semibold">{p.trxId}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Paid {format(new Date(p.createdAt), "MMM d, yyyy · h:mm a")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Users tab                                                           */
/* ------------------------------------------------------------------ */

function UserRow({
  user,
  onAuthError,
}: {
  user: AdminUser;
  onAuthError: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);

  const mutate = useMutation({
    mutationFn: (vars: { action: "grant" | "revoke"; days?: number }) =>
      setUserPremium(user.userId, vars, adminOptions()),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast({
        title: vars.action === "grant" ? "Premium granted" : "Premium removed",
      });
    },
    onError: (err) => {
      if (isUnauthorized(err)) return onAuthError();
      toast({ title: "Update failed", description: errMessage(err, "Try again."), variant: "destructive" });
    },
  });

  return (
    <Card className="border-border/50">
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{user.name || "Unnamed user"}</span>
            {user.isPremium ? (
              <Badge className="border-none bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950">
                <Crown className="mr-1 h-3 w-3" /> Premium
              </Badge>
            ) : (
              <Badge variant="outline">Free</Badge>
            )}
          </div>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          {user.isPremium && user.premiumExpiresAt && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> Expires{" "}
              {format(new Date(user.premiumExpiresAt), "MMM d, yyyy")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
              className="h-9 w-20"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
          <Button
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={() => mutate.mutate({ action: "grant", days })}
            disabled={mutate.isPending}
          >
            <ShieldCheck className="h-4 w-4" /> Grant
          </Button>
          {user.isPremium && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => mutate.mutate({ action: "revoke" })}
              disabled={mutate.isPending}
            >
              Revoke
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function UsersTab({ onAuthError }: { onAuthError: () => void }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const usersQuery = useQuery({
    queryKey: ["admin", "users", debounced],
    queryFn: () =>
      listAdminUsers(debounced ? { search: debounced } : undefined, adminOptions()),
  });

  useEffect(() => {
    if (isUnauthorized(usersQuery.error)) onAuthError();
  }, [usersQuery.error, onAuthError]);

  const users = usersQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-9"
        />
      </div>

      {usersQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 py-16 text-center text-muted-foreground">
          No users found.
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <UserRow key={u.userId} user={u} onAuthError={onAuthError} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings tab                                                        */
/* ------------------------------------------------------------------ */

function SettingsTab({ onAuthError }: { onAuthError: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [days, setDays] = useState("");
  const [loaded, setLoaded] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => getAdminSettings(adminOptions()),
  });

  useEffect(() => {
    if (isUnauthorized(settingsQuery.error)) onAuthError();
  }, [settingsQuery.error, onAuthError]);

  useEffect(() => {
    if (settingsQuery.data && !loaded) {
      setDays(String(settingsQuery.data.days));
      setLoaded(true);
    }
  }, [settingsQuery.data, loaded]);

  const save = useMutation({
    mutationFn: (body: AdminSettings) => updateAdminSettings(body, adminOptions()),
    onSuccess: (updated) => {
      queryClient.setQueryData(["admin", "settings"], updated);
      // Keep the field in sync with what the server actually stored.
      setDays(String(updated.days));
      toast({
        title: "Settings saved",
        description: "Students now see the new plan duration.",
      });
    },
    onError: (err) => {
      if (isUnauthorized(err)) return onAuthError();
      toast({
        title: "Could not save",
        description: errMessage(err, "Please check the values and try again."),
        variant: "destructive",
      });
    },
  });

  // bKash is fully removed — only the plan duration is editable. The legacy
  // bkashNumber/price fields are sent as placeholders; the server keeps its
  // stored values for anything invalid.
  const daysNum = Number(days);
  const daysValid = Number.isInteger(daysNum) && daysNum >= 1 && daysNum <= 3650;
  const formValid = daysValid;

  if (settingsQuery.isLoading) {
    return <Skeleton className="h-72 w-full max-w-xl rounded-2xl" />;
  }

  return (
    <Card className="max-w-xl border-border/50">
      <CardContent className="space-y-5 p-6">
        <div>
          <h3 className="text-lg font-semibold">Premium plan settings</h3>
          <p className="text-sm text-muted-foreground">
            Students pay <strong>$5.99 by card</strong> (via Whop) and Premium activates
            automatically — no manual approval needed. The card price is managed on your Whop
            dashboard. Here you can change how many days each payment gives.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (formValid) {
              save.mutate({ bkashNumber: "", price: 0, days: daysNum });
            }
          }}
          className="space-y-4"
        >
          <div className="max-w-[220px] space-y-2">
            <Label htmlFor="settings-days">Duration (days)</Label>
            <Input
              id="settings-days"
              type="number"
              min={1}
              max={3650}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
            {days && !daysValid && (
              <p className="text-xs text-destructive">Between 1 and 3650 days.</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Each $5.99 card payment gives the student this many days of Premium. Already-approved
            payments are not affected.
          </p>

          <Button type="submit" disabled={!formValid || save.isPending} className="gap-2 rounded-xl">
            {save.isPending ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            Save settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                              */
/* ------------------------------------------------------------------ */

function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [authed, setAuthed] = useState(false);
  const [ownerMode, setOwnerMode] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState("payments");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getAdminToken();
      let tokenOk = false;
      if (token) {
        try {
          await checkAdminSession(adminOptions());
          tokenOk = true;
        } catch {
          clearAdminToken();
        }
      }
      // Always resolve owner access too (even when a password token works),
      // so an owner who once used the password still gets owner-mode UX.
      // The Clerk token is attached automatically when no admin
      // Authorization header is present.
      try {
        await checkAdminSession();
        if (!cancelled) setOwnerMode(true);
        tokenOk = true;
      } catch {
        /* not the owner — password token (if any) decides access */
      }
      if (tokenOk && !cancelled) setAuthed(true);
    })().finally(() => {
      if (!cancelled) setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    clearAdminToken();
    queryClient.removeQueries({ queryKey: ["admin"] });
    if (ownerMode) {
      // Nothing to sign out of — owner access rides on the student session.
      navigate("/dashboard");
      return;
    }
    setAuthed(false);
  };

  const handleAuthError = () => {
    clearAdminToken();
    queryClient.removeQueries({ queryKey: ["admin"] });
    setOwnerMode(false);
    setAuthed(false);
    toast({ title: "Session expired", description: "Please sign in again." });
  };

  if (checking) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (!authed) {
    return <AdminLogin onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Brain className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <span className="text-lg font-bold tracking-tight">
                Learnova <span className="font-black text-primary">AI</span>
              </span>
              <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                Admin
              </span>
              {ownerMode && (
                <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  Owner
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> {ownerMode ? "Exit admin" : "Sign out"}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            View card payments and manage Premium access.
          </p>
        </div>

        <div className="mb-6">
          <StatsCards onAuthError={handleAuthError} />
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="h-4 w-4" /> Settings
            </TabsTrigger>
          </TabsList>
          <TabsContent value="payments">
            <PaymentsTab onAuthError={handleAuthError} />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab onAuthError={handleAuthError} />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab onAuthError={handleAuthError} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
export default memo(AdminPage);