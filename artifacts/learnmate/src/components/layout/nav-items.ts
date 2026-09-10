import {
  LayoutDashboard,
  Timer,
  BookOpen,
  Layers,
  Target,
  CalendarDays,
  FileText,
  TrendingUp,
  GraduationCap,
  Languages,
  CalendarClock,
  CalendarCheck,
  Bot,
  Crown,
  Cpu,
  Info,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  iconColor: string;
}

export interface NavSection {
  /** Section heading shown above the group. null = no heading (first group). */
  label: string | null;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [
      { label: "Dashboard",     href: "/dashboard",    icon: LayoutDashboard, description: "Your learning mission control", iconColor: "bg-blue-600" },
      { label: "Focus Studio",  href: "/tutor",        icon: Timer,           description: "Deep work Pomodoro timer", iconColor: "bg-violet-500" },
      { label: "Notes",         href: "/notes",        icon: BookOpen,        description: "AI-powered smart notes", iconColor: "bg-blue-500" },
      { label: "Flashcards",    href: "/flashcards",   icon: Layers,          description: "Spaced repetition decks", iconColor: "bg-purple-500" },
      { label: "Quizzes",       href: "/quizzes",      icon: Target,          description: "Test your knowledge", iconColor: "bg-emerald-500" },
      { label: "Planner",       href: "/planner",      icon: CalendarDays,    description: "Structured study plans", iconColor: "bg-amber-500" },
      { label: "Documents",     href: "/documents",    icon: FileText,        description: "Upload study materials", iconColor: "bg-pink-500" },
      { label: "Progress",      href: "/progress",     icon: TrendingUp,      description: "XP streaks & achievements", iconColor: "bg-cyan-500" },
      { label: "Exam Prep",     href: "/exam-prep",    icon: GraduationCap,   description: "Targeted exam revision", iconColor: "bg-orange-500" },
      { label: "Language",      href: "/language",     icon: Languages,       description: "English skill builder", iconColor: "bg-teal-500" },
      { label: "Exam Planner",  href: "/exam-planner", icon: CalendarClock,   description: "Timed exam schedule", iconColor: "bg-indigo-500" },
      { label: "Exam Calendar", href: "/exam-calendar", icon: CalendarCheck,  description: "Fix exam dates & routines", iconColor: "bg-rose-600" },
      { label: "AI Assistant",  href: "/assistant",    icon: Bot,             description: "Chat with AI tutor", iconColor: "bg-blue-500" },
      { label: "Premium",       href: "/premium",      icon: Crown,           description: "Unlock all features", iconColor: "bg-yellow-500" },
      { label: "About Us",      href: "/about",        icon: Info,            description: "Meet the team", iconColor: "bg-slate-500" },
    ],
  },
  {
    label: "Tech & Skills",
    items: [
      { label: "Tech Courses", href: "/courses", icon: Cpu, description: "Build technical skills", iconColor: "bg-red-500" },
    ],
  },
];

/** Flat list kept for any code that still imports NAV_ITEMS. */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
