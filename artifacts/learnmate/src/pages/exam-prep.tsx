import { useListExamTypes } from "@workspace/api-client-react";
import { getListExamTypesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCap, ArrowRight, BookOpen, Target, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ImportantQuestionsSection } from "@/components/premium/important-questions";

export default function ExamPrepPage() {
  const [, setLocation] = useLocation();
  const { data: exams, isLoading } = useListExamTypes({
    query: { queryKey: getListExamTypesQueryKey() }
  });

  const handleStartPrep = (examName: string) => {
    // Navigate to quizzes with the exam pre-filled as the quiz topic
    setLocation(`/quizzes?subject=${encodeURIComponent(examName)}`);
  };

  const groupedExams = exams?.reduce((acc, exam) => {
    if (!acc[exam.category]) {
      acc[exam.category] = [];
    }
    acc[exam.category].push(exam);
    return acc;
  }, {} as Record<string, typeof exams>);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-12 max-w-6xl mx-auto pb-12"
    >
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-8 sm:p-12 text-white shadow-xl">
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4 pointer-events-none">
          <GraduationCap className="w-96 h-96" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <Badge className="bg-white/20 hover:bg-white/30 text-white border-none mb-4 backdrop-blur-md">Targeted Preparation</Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">Ace your next big exam</h1>
          <p className="text-lg text-white/90 mb-8 max-w-xl">
            Choose your target exam to access specialised practice quizzes, tailored study plans, and topic-focused preparation.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button
              size="lg"
              variant="secondary"
              className="bg-white text-indigo-600 hover:bg-white/90 rounded-full px-8"
              onClick={() => setLocation("/quizzes")}
            >
              Take a Practice Quiz
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-white/10 text-white border-white/30 hover:bg-white/20 rounded-full px-8"
              onClick={() => setLocation("/planner")}
            >
              Build a Study Plan
            </Button>
          </div>
        </div>
      </div>

      {/* AI Important Questions (Premium) */}
      <ImportantQuestionsSection />

      {isLoading ? (
        <div className="space-y-8">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-6 md:grid-cols-3">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {Object.entries(groupedExams || {}).map(([category, categoryExams]) => (
            <div key={category} className="space-y-6">
              <h2 className="text-2xl font-bold flex items-center gap-2 border-b border-border/50 pb-2">
                {category === 'Standardized' ? <Target className="h-6 w-6 text-primary" /> : <BookOpen className="h-6 w-6 text-emerald-500" />}
                {category} Exams
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {categoryExams.map(exam => (
                  <Card key={exam.id} className="glass-card hover:-translate-y-1 hover:shadow-lg transition-all group border-border/50 overflow-hidden flex flex-col">
                    <CardHeader className="bg-secondary/20 pb-4">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className="bg-background">{exam.category}</Badge>
                      </div>
                      <CardTitle className="text-2xl tracking-tight">{exam.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 flex-1">
                      <CardDescription className="text-sm leading-relaxed">{exam.description}</CardDescription>
                    </CardContent>
                    <div className="p-4 pt-0 mt-auto">
                      <Button 
                        className="w-full justify-between rounded-xl group-hover:bg-primary group-hover:text-primary-foreground" 
                        variant="secondary"
                        onClick={() => handleStartPrep(exam.name)}
                      >
                        Start Prep <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
