import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetExamType,
  getGetExamTypeQueryKey,
  useGenerateExamDeepDive,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/markdown";
import { useToast } from "@/hooks/use-toast";
import { usePremium } from "@/hooks/use-premium";
import { PremiumGate } from "@/components/premium/premium-gate";
import { PremiumBadge } from "@/components/premium/premium-status";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Gauge,
  GraduationCap,
  Lightbulb,
  ListChecks,
  Lock,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import { motion } from "framer-motion";

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value?: string;
}) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1.5 text-sm font-medium leading-snug">{value}</p>
    </div>
  );
}

export default function ExamDetailPage() {
  const [, params] = useRoute("/exam-prep/:examId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isPremium, isLoadingPremium } = usePremium();
  const examId = params?.examId ?? "";

  const { data: exam, isLoading, isError } = useGetExamType(examId, {
    query: { queryKey: getGetExamTypeQueryKey(examId), enabled: !!examId },
  });

  const deepDive = useGenerateExamDeepDive();
  const [briefing, setBriefing] = useState<{
    summary: string;
    sections: { heading: string; body: string }[];
    highYieldTopics?: string[];
    commonMistakes?: string[];
    sources?: string[];
  } | null>(null);
  const [locked, setLocked] = useState(false);

  const handleDeepDive = () => {
    deepDive.mutate(
      { data: { examId } },
      {
        onSuccess: (result) => {
          setBriefing(result);
          setLocked(false);
        },
        onError: (err) => {
          const e = err as { status?: number; data?: { error?: string } | null } | null;
          // Premium gate — show the upsell instead of a scary error toast.
          if (e?.status === 403) {
            setLocked(true);
            return;
          }
          toast({
            title: "Could not generate the briefing",
            description: e?.data?.error ?? "Please try again in a moment.",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (isError || !exam) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold">Exam not found</h1>
        <p className="text-muted-foreground">
          We do not have details for that exam yet.
        </p>
        <Button onClick={() => setLocation("/exam-prep")} data-testid="button-back-to-exams">
          Back to exam prep
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-5xl mx-auto space-y-8 pb-12"
      data-testid="page-exam-detail"
    >
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 gap-2 text-muted-foreground"
        onClick={() => setLocation("/exam-prep")}
        data-testid="button-back"
      >
        <ArrowLeft className="h-4 w-4" /> All exams
      </Button>

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 opacity-10 translate-x-1/4 -translate-y-1/4 pointer-events-none">
          <GraduationCap className="w-72 h-72" />
        </div>
        <div className="relative z-10 space-y-3 max-w-3xl">
          <Badge className="bg-white/20 hover:bg-white/30 text-white border-none backdrop-blur-md">
            {exam.category}
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight" data-testid="text-exam-name">
            {exam.name}
          </h1>
          {exam.fullName && <p className="text-white/80 text-sm">{exam.fullName}</p>}
          <p className="text-white/90">{exam.description}</p>
        </div>
      </div>

      {/* At a glance */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Clock} label="Total time" value={exam.totalTime} />
        <StatTile icon={ListChecks} label="Questions" value={exam.totalQuestions} />
        <StatTile icon={Gauge} label="Scoring" value={exam.scoring} />
        <StatTile icon={CheckCircle2} label="Validity" value={exam.validity} />
      </div>

      {exam.format && (
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" /> Format
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{exam.format}</p>
          </CardContent>
        </Card>
      )}

      {/* Structure */}
      {exam.sections && exam.sections.length > 0 && (
        <Card className="glass-card border-border/50" data-testid="card-exam-sections">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-emerald-500" /> Exam structure
            </CardTitle>
            <CardDescription>What you sit, in order, and how long you get.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {exam.sections.map((section, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-1.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{section.name}</span>
                  {section.questions && (
                    <Badge variant="secondary" className="text-xs">
                      {section.questions} questions
                    </Badge>
                  )}
                  {section.minutes && (
                    <Badge variant="outline" className="text-xs">
                      {section.minutes} min
                    </Badge>
                  )}
                </div>
                {section.detail && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{section.detail}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Syllabus */}
      {exam.topics && exam.topics.length > 0 && (
        <Card className="glass-card border-border/50" data-testid="card-exam-topics">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-indigo-500" /> Topics to study
            </CardTitle>
            <CardDescription>The syllabus areas this exam actually tests.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {exam.topics.map((topic, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card/40 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-sm">{topic.area}</h3>
                  {topic.weight && (
                    <Badge className="bg-primary/15 text-primary border-none text-xs">
                      {topic.weight}
                    </Badge>
                  )}
                </div>
                <ul className="space-y-1">
                  {topic.items.map((item, j) => (
                    <li key={j} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Key facts + tips */}
      <div className="grid gap-6 md:grid-cols-2">
        {exam.keyFacts && exam.keyFacts.length > 0 && (
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" /> Key facts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {exam.keyFacts.map((fact, i) => (
                  <li key={i} className="text-sm flex gap-2 leading-relaxed">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {exam.studyTips && exam.studyTips.length > 0 && (
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-pink-500" /> How to study for it
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {exam.studyTips.map((tip, i) => (
                  <li key={i} className="text-sm flex gap-2 leading-relaxed">
                    <span className="text-primary font-semibold shrink-0">{i + 1}.</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Premium AI deep dive */}
      <Card className="glass-card border-primary/30 bg-primary/5" data-testid="card-deep-dive">
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> AI study briefing
            </CardTitle>
            <PremiumBadge />
          </div>
          <CardDescription>
            A personalised breakdown for the {exam.name}, generated from the verified exam facts
            above so it reflects the current format.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Free users never get the generate button: the feature is premium.
              The server enforces this too (requireAuth + requirePremium), so
              this is presentation, not the security boundary. */}
          {!isPremium && !isLoadingPremium && (
            <PremiumGate
              title="AI study briefing is a Premium feature"
              description={`Unlock a personalised ${exam.name} briefing built from the verified exam facts above.`}
              features={[
                "Section-by-section preparation plan",
                "High-yield topics worth your study time",
                "The mistakes students most often make",
              ]}
              className="text-left"
            />
          )}

          {isPremium && !briefing && !locked && (
            <Button
              onClick={handleDeepDive}
              disabled={deepDive.isPending}
              className="rounded-xl"
              data-testid="button-generate-deep-dive"
            >
              {deepDive.isPending ? (
                <>Generating your briefing…</>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Generate my study briefing
                </>
              )}
            </Button>
          )}

          {locked && (
            <div
              className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-5 space-y-3"
              data-testid="panel-deep-dive-locked"
            >
              <div className="flex items-center gap-2 font-semibold">
                <Lock className="h-4 w-4 text-amber-500" /> This is a Premium feature
              </div>
              <p className="text-sm text-muted-foreground">
                Upgrade to generate AI study briefings for every exam, with high-yield topics and
                the mistakes most students make.
              </p>
              <Button
                onClick={() => setLocation("/premium")}
                className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white"
                data-testid="button-upgrade-premium"
              >
                Upgrade to Premium
              </Button>
            </div>
          )}

          {briefing && (
            <div className="space-y-5" data-testid="panel-deep-dive-result">
              <p className="text-sm leading-relaxed">{briefing.summary}</p>

              {briefing.sections.map((section, i) => (
                <div key={i} className="space-y-1.5">
                  <h3 className="font-semibold text-sm text-primary">{section.heading}</h3>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    <Markdown content={section.body} />
                  </div>
                </div>
              ))}

              {briefing.highYieldTopics && briefing.highYieldTopics.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-emerald-500" /> High-yield topics
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {briefing.highYieldTopics.map((topic, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {briefing.commonMistakes && briefing.commonMistakes.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <TriangleAlert className="h-4 w-4 text-amber-500" /> Common mistakes
                  </h3>
                  <ul className="space-y-1.5">
                    {briefing.commonMistakes.map((mistake, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2">
                        <span className="text-amber-500 mt-0.5">•</span>
                        <span>{mistake}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleDeepDive}
                disabled={deepDive.isPending}
                className="rounded-xl"
                data-testid="button-regenerate-deep-dive"
              >
                Regenerate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          className="rounded-xl flex-1"
          onClick={() => setLocation(`/quizzes?subject=${encodeURIComponent(exam.name)}`)}
          data-testid="button-practice-quiz"
        >
          Practise {exam.name} questions
        </Button>
        <Button
          variant="outline"
          className="rounded-xl flex-1"
          onClick={() => setLocation("/planner")}
          data-testid="button-build-plan"
        >
          Build a study plan
        </Button>
      </div>

      {/* Provenance — students should be able to check the source themselves. */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {exam.officialSite && (
          <a
            href={exam.officialSite}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary hover:underline"
            data-testid="link-official-site"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Official exam website
          </a>
        )}
        {exam.lastVerified && <span>Details verified {exam.lastVerified}</span>}
      </div>
    </motion.div>
  );
}
