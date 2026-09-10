import { useGetProgressStats, getGetProgressStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { 
  Trophy, 
  Flame, 
  Sparkles, 
  Clock, 
  Target, 
  BookOpen, 
  Layers, 
  FileText,
  TrendingUp,
  Award,
  ChevronRight
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from "recharts";

export default function ProgressPage() {
  const { data: stats, isLoading } = useGetProgressStats({
    query: {
      queryKey: getGetProgressStatsQueryKey()
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[400px] rounded-2xl" />
          <Skeleton className="h-[400px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const currentLevelXp = stats.xp % 1000;
  const xpForNextLevel = 1000;
  const progressPercent = (currentLevelXp / xpForNextLevel) * 100;

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-6xl mx-auto space-y-8"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Progress</h1>
          <p className="text-muted-foreground mt-1">Track your learning journey and achievements.</p>
        </div>
      </div>

      {/* Level Banner */}
      <Card className="relative overflow-hidden border-0 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 opacity-100"></div>
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
          <Trophy className="w-64 h-64 -mt-12 -mr-12 text-white" />
        </div>
        <CardContent className="p-8 relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 shadow-[0_0_40px_rgba(255,255,255,0.6)] ring-[6px] ring-white/40">
              <span className="text-4xl font-bold">{stats.level}</span>
            </div>
            <div className="flex-1 w-full text-center md:text-left text-white">
              <h2 className="text-2xl font-bold mb-1">Level {stats.level} Scholar</h2>
              <p className="text-blue-100 mb-4">You have {stats.xp} total XP. {xpForNextLevel - currentLevelXp} XP to next level.</p>
              <div className="flex items-center gap-4">
                <Progress value={progressPercent} className="flex-1 h-3 bg-white/20" />
                <span className="text-sm font-medium whitespace-nowrap">{Math.round(progressPercent)}%</span>
              </div>
            </div>
            <div className="flex gap-4 shrink-0 mt-4 md:mt-0">
              <div className="flex flex-col items-center p-3 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 min-w-[100px]">
                <Flame className="h-6 w-6 text-amber-400 mb-1 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                <span className="text-xl font-bold text-white">{stats.streak}</span>
                <span className="text-xs text-blue-100 uppercase tracking-wider">Day Streak</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 min-w-[100px]">
                <Sparkles className="h-6 w-6 text-emerald-400 mb-1 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                <span className="text-xl font-bold text-white">{stats.coins}</span>
                <span className="text-xs text-blue-100 uppercase tracking-wider">Coins</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lifetime Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white shadow-[0_0_16px_rgba(59,130,246,0.4)]">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(stats.totalStudyMinutes / 60)}h</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Study Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-500 text-white shadow-[0_0_16px_rgba(168,85,247,0.4)]">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.flashcardsReviewed}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Cards Reviewed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.4)]">
                <Target className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.quizzesCompleted}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Quizzes Passed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-[0_0_16px_rgba(245,158,11,0.4)]">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.averageQuizScore}%</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Avg Quiz Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Subject Breakdown */}
        <Card className="glass-card flex flex-col">
          <CardHeader>
            <CardTitle>Subject Breakdown</CardTitle>
            <CardDescription>Where you spend your learning time</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center min-h-[300px]">
            {stats.subjectBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.subjectBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="subject"
                  >
                    {stats.subjectBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
                    formatter={(value: number, name: string) => [`${value} activities`, name]}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Not enough data yet.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="glass-card flex flex-col">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest learning actions</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-1">
              {stats.recentActivity.map((activity, i) => (
                <div key={i} className="flex items-center gap-3 py-3 border-b border-border/40 last:border-0 transition-all hover:bg-muted/30 -mx-2 px-2 rounded-lg">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20 text-primary shadow-sm">
                    {activity.type === 'quiz' ? <Target className="h-5 w-5" /> :
                     activity.type === 'flashcard' ? <Layers className="h-5 w-5" /> :
                     activity.type === 'note' ? <BookOpen className="h-5 w-5" /> :
                     <FileText className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(activity.createdAt), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20 px-2.5 py-1 rounded-full shrink-0">
                    +{activity.xpEarned} XP
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              ))}
              {stats.recentActivity.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <p>No recent activity.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Achievements */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Achievements</CardTitle>
          <CardDescription>Badges you've earned along the way</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {stats.achievements.map((achievement) => (
              <div key={achievement.id} className="flex flex-col items-center text-center p-4 rounded-xl glass-card transition-all hover:scale-105">
                <div className="text-4xl mb-3">{achievement.icon}</div>
                <h4 className="font-semibold text-sm mb-1">{achievement.title}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{achievement.description}</p>
              </div>
            ))}
            {stats.achievements.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-12 border-2 border-dashed border-border rounded-xl">
                <Award className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Complete quizzes and study plans to unlock achievements!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
