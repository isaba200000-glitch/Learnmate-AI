import { useEffect, useRef, lazy, Suspense } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Pages (lazy-loaded so each route only downloads its own code)
import LandingPage from "./pages/landing";
import { FocusModeProvider } from "./components/focus/focus-mode";
import NotFound from "./pages/not-found";

const DashboardPage = lazy(() => import("./pages/dashboard"));
const FocusStudioPage = lazy(() => import("./pages/focus-studio"));
const NotesPage = lazy(() => import("./pages/notes"));
const FlashcardsPage = lazy(() => import("./pages/flashcards"));
const QuizzesPage = lazy(() => import("./pages/quizzes"));
const PlannerPage = lazy(() => import("./pages/planner"));
const DocumentsPage = lazy(() => import("./pages/documents"));
const ProgressPage = lazy(() => import("./pages/progress"));
const ExamPrepPage = lazy(() => import("./pages/exam-prep"));
const ExamDetailPage = lazy(() => import("./pages/exam-detail"));
const LanguagePage = lazy(() => import("./pages/language"));
const ExamPlannerPage = lazy(() => import("./pages/exam-planner"));
const AssistantPage = lazy(() => import("./pages/assistant"));
const ProfilePage = lazy(() => import("./pages/profile"));
const PremiumPage = lazy(() => import("./pages/premium"));
const AdminPage = lazy(() => import("./pages/admin"));
const CoursesPage = lazy(() => import("./pages/courses"));
const AboutPage        = lazy(() => import("./pages/about"));
const PrivacyPolicyPage = lazy(() => import("./pages/privacy-policy"));
const SupportPage      = lazy(() => import("./pages/support"));
const ExamCalendarPage = lazy(() => import("./pages/exam-calendar"));

import AppLayout from "./components/layout/app-layout";

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "") || null;

// The generated client already includes the `/api` prefix in every endpoint.
// Only prepend the external server origin here, otherwise hosted requests
// become `/api/api/...`.
setBaseUrl(apiBaseUrl);

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

// Detect when Clerk is not configured (missing or placeholder key)
const isClerkConfigured =
  !!clerkPubKey &&
  clerkPubKey.startsWith("pk_") &&
  !clerkPubKey.includes("xxxxxxxx");

function ClerkSetupScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <svg className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Clerk Authentication Required</h1>
          <p className="text-muted-foreground text-sm">
            A valid Clerk publishable key is required to run Learnova.
          </p>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-left space-y-3 border border-border/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Setup Steps</p>
          <ol className="text-sm text-muted-foreground space-y-2">
            <li className="flex gap-2">
              <span className="font-bold text-foreground shrink-0">1.</span>
              Sign up free at <span className="font-medium text-foreground">clerk.com</span> and create an application
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-foreground shrink-0">2.</span>
              Copy your Publishable Key from the Clerk dashboard
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-foreground shrink-0">3.</span>
              Add it to your <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">.env</code> file:
              <code className="block bg-muted px-2 py-1.5 rounded text-xs font-mono mt-1 text-foreground">
                VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
              </code>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-foreground shrink-0">4.</span>
              Restart the dev server
            </li>
          </ol>
        </div>
        <p className="text-xs text-muted-foreground">
          See <code className="bg-muted px-1 py-0.5 rounded">.env.example</code> for all supported variables.
        </p>
      </div>
    </div>
  );
}

// Detect Median (formerly GoNative) WebView — it injects window.median or sets
// "Median" / "gonative" in the user-agent. When running inside the app we hide
// the Google/social buttons because Google OAuth always escapes to Chrome.
const isMedianApp =
  typeof (window as any).median !== "undefined" ||
  /median|gonative/i.test(navigator.userAgent);

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(217, 91%, 60%)",        // royal blue
    colorForeground: "hsl(210, 40%, 96%)",      // near-white text on dark
    colorMutedForeground: "hsl(215, 20%, 65%)",
    colorDanger: "hsl(0, 72%, 55%)",
    colorSuccess: "hsl(160, 84%, 50%)",
    colorBackground: "hsl(222, 47%, 9%)",        // deep slate card surface
    colorInput: "hsl(217, 33%, 17%)",           // dark input bg
    colorInputForeground: "hsl(210, 40%, 96%)", // near-white input text
    colorNeutral: "hsl(217, 33%, 20%)",         // dark border tone
    fontFamily: "'Inter', system-ui, sans-serif",
    borderRadius: "0.875rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-slate-900 rounded-2xl w-[440px] max-w-full overflow-hidden shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)] border border-white/10",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-semibold tracking-tight text-slate-50",
    headerSubtitle: "text-sm text-slate-400",
    socialButtonsBlockButtonText: "text-sm font-medium text-slate-100",
    formFieldLabel: "text-sm font-medium text-slate-300",
    footerActionLink: "text-primary hover:text-primary/90 font-medium",
    footerActionText: "text-slate-400",
    dividerText: "text-slate-400 text-sm",
    identityPreviewEditButton: "text-primary hover:text-primary/90",
    formFieldSuccessText: "text-emerald-400",
    alertText: "text-sm font-medium text-red-400",
    logoBox: "h-12 flex items-center justify-center mb-6",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: isMedianApp
      ? "!hidden"
      : "rounded-lg border border-white/10 bg-slate-800 text-slate-100 hover:bg-slate-700 transition-colors",
    socialButtonsBlockButtonArrow: isMedianApp ? "!hidden" : "",
    dividerRow: isMedianApp ? "!hidden" : "",
    formButtonPrimary:
      "rounded-lg bg-gradient-to-r from-[hsl(225,64%,33%)] to-[hsl(217,91%,60%)] text-white hover:shadow-[0_8px_24px_rgba(37,99,235,0.5)] transition-all shadow-sm",
    formFieldInput:
      "rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-primary focus:border-primary transition-all",
    footerAction: "mt-6 text-center text-sm",
    dividerLine: "bg-white/10",
    alert: "rounded-lg bg-red-500/10 border border-red-500/30 p-3",
    otpCodeFieldInput:
      "rounded-lg border border-white/10 focus:ring-2 focus:ring-primary text-lg text-center bg-slate-800 text-slate-100",
    formFieldRow: "mb-4",
    main: "p-6 sm:p-8",
  },
};

function SignInPage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 overflow-hidden">
      {/* Navy hero surface — large, soft, anchors the page. */}
      <div className="absolute inset-x-0 top-0 -z-10 h-[55%] bg-gradient-to-b from-brand via-brand-deep to-[hsl(225,64%,40%)]">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_left,_rgba(255,255,255,0.15),_transparent_60%)]" />
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_rgba(96,165,250,0.5),_transparent_60%)]" />
      </div>
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,_hsl(225,64%,33%_/_0.06),_transparent_60%)]" />
      <div className="w-full max-w-md relative">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[55%] bg-gradient-to-b from-brand via-brand-deep to-[hsl(225,64%,40%)]">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_left,_rgba(255,255,255,0.15),_transparent_60%)]" />
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_rgba(96,165,250,0.5),_transparent_60%)]" />
      </div>
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,_hsl(225,64%,33%_/_0.06),_transparent_60%)]" />
      <div className="w-full max-w-md relative">
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  return (
    <>
      <Show when="signed-in">
        <AppLayout>
          <Component />
        </AppLayout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkAuthConfigurator() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
});

function App() {
  if (!isClerkConfigured) {
    return (
      <ThemeProvider>
        <ClerkSetupScreen />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <WouterRouter base={basePath}>
        <ClerkProvider
          publishableKey={clerkPubKey}
          proxyUrl={clerkProxyUrl}
          appearance={clerkAppearance}
          signInUrl={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
        >
          <QueryClientProvider client={queryClient}>
            <ClerkAuthConfigurator />
            <ClerkQueryClientCacheInvalidator />
            <TooltipProvider>
              <FocusModeProvider>
              <Suspense fallback={<PageLoader />}>
              <Switch>
                <Route path="/" component={HomeRedirect} />
                <Route path="/sign-in/*?" component={SignInPage} />
                <Route path="/sign-up/*?" component={SignUpPage} />
                <Route path="/admin" component={AdminPage} />
                
                <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
                <Route path="/tutor" component={() => <ProtectedRoute component={FocusStudioPage} />} />
                <Route path="/notes" component={() => <ProtectedRoute component={NotesPage} />} />
                <Route path="/flashcards" component={() => <ProtectedRoute component={FlashcardsPage} />} />
                <Route path="/quizzes" component={() => <ProtectedRoute component={QuizzesPage} />} />
                <Route path="/planner" component={() => <ProtectedRoute component={PlannerPage} />} />
                <Route path="/documents" component={() => <ProtectedRoute component={DocumentsPage} />} />
                <Route path="/progress" component={() => <ProtectedRoute component={ProgressPage} />} />
                <Route path="/exam-prep/:examId" component={() => <ProtectedRoute component={ExamDetailPage} />} />
                <Route path="/exam-prep" component={() => <ProtectedRoute component={ExamPrepPage} />} />
                <Route path="/language" component={() => <ProtectedRoute component={LanguagePage} />} />
                <Route path="/exam-planner" component={() => <ProtectedRoute component={ExamPlannerPage} />} />
                <Route path="/assistant" component={() => <ProtectedRoute component={AssistantPage} />} />
                <Route path="/premium" component={() => <ProtectedRoute component={PremiumPage} />} />
                <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} />} />
                <Route path="/courses" component={() => <ProtectedRoute component={CoursesPage} />} />
                <Route path="/exam-calendar" component={() => <ProtectedRoute component={ExamCalendarPage} />} />
                <Route path="/about"          component={() => <ProtectedRoute component={AboutPage} />} />
                <Route path="/privacy-policy" component={() => <Suspense fallback={null}><PrivacyPolicyPage /></Suspense>} />
                <Route path="/support"        component={() => <Suspense fallback={null}><SupportPage /></Suspense>} />

                <Route component={NotFound} />
              </Switch>
              </Suspense>
              </FocusModeProvider>
              <Toaster />
            </TooltipProvider>
          </QueryClientProvider>
        </ClerkProvider>
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
