// Subject-specific prompt banks for the AI Assistant empty state.
// Each tab exposes 4 emoji-prefixed starter prompts + a "surprise me" pool.

export type SubjectId = "all" | "maths" | "science" | "languages" | "exam";

export type PromptChip = {
  emoji: string;
  text: string;
};

export const SUBJECTS: { id: SubjectId; label: string; emoji: string }[] = [
  { id: "all",      label: "All Topics", emoji: "✨" },
  { id: "maths",    label: "Maths",      emoji: "🧮" },
  { id: "science",  label: "Science",    emoji: "🔬" },
  { id: "languages",label: "Languages",  emoji: "🌍" },
  { id: "exam",     label: "Exam Prep",  emoji: "🎯" },
];

const ALL_PROMPTS: PromptChip[] = [
  { emoji: "🧠", text: "Explain a concept I should know for my next exam" },
  { emoji: "📚", text: "Summarize the key points from my latest notes" },
  { emoji: "✍️", text: "Help me write an essay outline on a topic of my choice" },
  { emoji: "🗓️", text: "Build a 1-week revision plan starting today" },
];

const MATHS_PROMPTS: PromptChip[] = [
  { emoji: "🧮", text: "Explain the chain rule with a worked example" },
  { emoji: "📐", text: "Solve a quadratic equation step by step" },
  { emoji: "🧠", text: "Help me memorize the unit circle in 5 minutes" },
  { emoji: "✏️", text: "Check my algebra working and fix mistakes" },
];

const SCIENCE_PROMPTS: PromptChip[] = [
  { emoji: "🧬", text: "Explain photosynthesis like I'm 12" },
  { emoji: "⚗️", text: "Balance this chemical equation for me" },
  { emoji: "🌍", text: "Walk me through plate tectonics basics" },
  { emoji: "🔬", text: "Outline a perfect lab report structure" },
];

const LANGUAGES_PROMPTS: PromptChip[] = [
  { emoji: "🇪🇸", text: "Teach me 10 essential Spanish greetings with pronunciation" },
  { emoji: "🇫🇷", text: "Explain French present-tense conjugations" },
  { emoji: "🇧🇩", text: "বাংলা সালাম — common Bangla greetings and replies" },
  { emoji: "🇯🇵", text: "Walk me through the Japanese Hiragana basics" },
];

const EXAM_PROMPTS: PromptChip[] = [
  { emoji: "📝", text: "Give me 5 GCSE-style past paper tips" },
  { emoji: "🎯", text: "Build a 4-week A Level study plan for biology" },
  { emoji: "📚", text: "Practice 3 SSC Math questions with worked solutions" },
  { emoji: "🗓️", text: "Create an HSC exam countdown checklist" },
];

const BANK: Record<SubjectId, PromptChip[]> = {
  all: ALL_PROMPTS,
  maths: MATHS_PROMPTS,
  science: SCIENCE_PROMPTS,
  languages: LANGUAGES_PROMPTS,
  exam: EXAM_PROMPTS,
};

export function promptsFor(subject: SubjectId): PromptChip[] {
  return BANK[subject] ?? ALL_PROMPTS;
}

const ALL_POOL: PromptChip[] = [
  ...ALL_PROMPTS,
  ...MATHS_PROMPTS,
  ...SCIENCE_PROMPTS,
  ...LANGUAGES_PROMPTS,
  ...EXAM_PROMPTS,
];

export function surprisePrompt(): PromptChip {
  return ALL_POOL[Math.floor(Math.random() * ALL_POOL.length)];
}

// Quick commands surfaced above the input area.
export type QuickCommand = {
  id: string;
  emoji: string;
  label: string;
  prompt: string;
};

export const QUICK_COMMANDS: QuickCommand[] = [
  {
    id: "summarize",
    emoji: "📋",
    label: "Summarize",
    prompt: "Summarize the key points I should remember from my most recent notes. Use bullet points.",
  },
  {
    id: "quiz",
    emoji: "🧠",
    label: "Quiz me",
    prompt: "Quiz me with 5 questions on a topic of your choice. Mix easy and hard. Show answers only after I answer each one.",
  },
  {
    id: "outline",
    emoji: "✍️",
    label: "Essay outline",
    prompt: "Write a 5-paragraph essay outline on a topic of your choice. Include thesis, three arguments, and a conclusion.",
  },
  {
    id: "plan",
    emoji: "🗓️",
    label: "Study plan",
    prompt: "Build me a 7-day study plan with 2-hour daily sessions. Include rest days and one mock exam.",
  },
];
