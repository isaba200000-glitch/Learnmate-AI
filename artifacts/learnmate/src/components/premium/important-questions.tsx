import { useState } from "react";
import {
  useGenerateImportantQuestions,
  type ImportantQuestion,
} from "@workspace/api-client-react";
import { usePremium } from "@/hooks/use-premium";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { Markdown } from "@/components/markdown";
import { PremiumGate } from "@/components/premium/premium-gate";
import { PremiumBadge } from "@/components/premium/premium-status";
import { Sparkles, ListChecks } from "lucide-react";

export function ImportantQuestionsSection() {
  const { isPremium } = usePremium();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [examType, setExamType] = useState("");
  const [count, setCount] = useState("10");
  const [questions, setQuestions] = useState<ImportantQuestion[]>([]);
  const generate = useGenerateImportantQuestions();

  const handleGenerate = () => {
    if (!subject.trim()) {
      toast({
        title: "Add a subject",
        description: "Tell us which subject to prepare questions for.",
        variant: "destructive",
      });
      return;
    }
    setQuestions([]);
    generate.mutate(
      {
        data: {
          subject: subject.trim(),
          examType: examType.trim() || undefined,
          count: Number(count),
        },
      },
      {
        onSuccess: (res) => setQuestions(res.questions),
        onError: () =>
          toast({
            title: "Could not generate questions",
            description: "Please try again in a moment.",
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/50 pb-2">
        <ListChecks className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Important Questions</h2>
        <PremiumBadge />
      </div>

      {isPremium ? (
        <Card className="glass-card border-border/50">
          <CardContent className="space-y-5 p-6">
            <p className="text-sm text-muted-foreground">
              Get AI-predicted likely exam questions with model answers and explanations.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="iq-subject">Subject</Label>
                <Input
                  id="iq-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Physics, Bangla 2nd Paper"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="iq-exam">Exam (optional)</Label>
                <Input
                  id="iq-exam"
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  placeholder="e.g. HSC, SSC"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="iq-count">How many</Label>
                <Select value={count} onValueChange={setCount}>
                  <SelectTrigger id="iq-count">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 questions</SelectItem>
                    <SelectItem value="10">10 questions</SelectItem>
                    <SelectItem value="15">15 questions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generate.isPending}
              className="gap-2 rounded-xl"
            >
              {generate.isPending ? (
                <>
                  <Spinner className="h-4 w-4" /> Predicting questions...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Generate questions
                </>
              )}
            </Button>

            {questions.length > 0 && (
              <Accordion type="single" collapsible className="w-full animate-in fade-in">
                {questions.map((q, i) => (
                  <AccordionItem key={i} value={`q-${i}`}>
                    <AccordionTrigger className="text-left">
                      <span className="flex gap-2">
                        <span className="font-bold text-primary">Q{i + 1}.</span>
                        <span>{q.question}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                            Answer
                          </p>
                          <Markdown content={q.answer} />
                        </div>
                        {q.explanation && (
                          <div className="rounded-lg bg-secondary/40 p-3">
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Why it matters
                            </p>
                            <Markdown content={q.explanation} className="text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      ) : (
        <PremiumGate
          title="Important Questions is a Premium feature"
          description="Unlock AI-predicted exam questions with full answers to focus your revision."
          features={[
            "Likely questions tailored to your subject & exam",
            "Model answers with clear explanations",
            "Also includes the Smart Notes Maker",
          ]}
        />
      )}
    </section>
  );
}
