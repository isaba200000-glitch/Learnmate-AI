import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MotionFade, MotionStagger, MotionStaggerItem } from "@/components/motion";
import {
  Brain, Timer, Target, Zap, LayoutDashboard, Layers,
  FileText, Trophy, MapPin, Phone, MessageCircle,
  ExternalLink, Award, Rocket, Users, GraduationCap, Globe,
  ArrowRight, Sparkles,
} from "lucide-react";

const FEATURES = [
  { icon: Timer,         title: "Focus Studio",      description: "Stay in flow with the Pomodoro technique. Set focus timers, mix ambient soundscapes, and track your sessions.", color: "text-primary", bg: "bg-primary/10" },
  { icon: Layers,        title: "Flashcards",        description: "Create custom flashcard decks, flip through cards, and review at your own pace to lock in long-term memory.",  color: "text-brand-deep", bg: "bg-brand-deep/10" },
  { icon: Target,        title: "Practice Quizzes",  description: "Test yourself with real multiple-choice questions drawn from thousands of topics across all difficulty levels.", color: "text-success", bg: "bg-success/10" },
  { icon: LayoutDashboard, title: "Study Planner",   description: "Set your exam date and subjects. Learnova builds a structured day-by-day schedule using proven study phases.", color: "text-amber-600", bg: "bg-amber-500/10" },
  { icon: FileText,      title: "Document Analyser", description: "Upload your notes or textbook extracts. Get an instant readability report, reading time, and top keywords.",   color: "text-pink-600", bg: "bg-pink-500/10" },
  { icon: Zap,           title: "Gamified Progress", description: "Earn XP, maintain study streaks, unlock achievements, and level up as you hit your study goals.",             color: "text-orange-600", bg: "bg-orange-500/10" },
] as const;

const HOW_IT_WORKS = [
  { step: "1", title: "Set your goals",    desc: "Enter your subjects and exam dates to get a personalised study schedule." },
  { step: "2", title: "Study with focus",  desc: "Use the Pomodoro timer, quizzes, and flashcards to study in short, effective bursts." },
  { step: "3", title: "Track your growth", desc: "Earn XP, maintain streaks, and watch your progress compound over time." },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background selection:bg-primary/30">
      {/* ── Header ── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60"
      >
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-deep text-white shadow-[0_4px_16px_rgba(30,58,138,0.35)] transition-transform group-hover:scale-105">
              <Brain className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">Learnova</span>
          </Link>
          <nav className="hidden md:flex gap-7 text-sm font-medium text-muted-foreground">
            <a href="#features"   className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it Works</a>
            <a href="#about"      className="hover:text-foreground transition-colors">About Us</a>
            <a href="#contact"    className="hover:text-foreground transition-colors">Contact</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="rounded-full px-5">
                Get Started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </motion.header>

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy via-[#1e3a6e] to-[#0F172A] pt-24 pb-24 md:pt-32 md:pb-32">
          <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-[#2563EB]/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 h-56 w-56 rounded-full bg-[#3B82F6]/10 blur-3xl" />
          <div className="pointer-events-none absolute right-1/4 bottom-0 h-40 w-40 rounded-full bg-amber-500/10 blur-2xl" />
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center text-center space-y-7">
              <MotionFade>
                <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white backdrop-blur-md">
                  <motion.span
                    className="mr-2 inline-block"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
                  >
                    <Sparkles className="h-4 w-4" />
                  </motion.span>
                  Your Complete Study Toolkit — All in One Place
                </div>
              </MotionFade>

              <MotionFade delay={0.08}>
                <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl [text-shadow:0_2px_24px_rgba(0,0,0,0.4)]">
                  Master any subject with{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-200 via-white to-blue-200">
                    smarter study habits
                  </span>
                </h1>
              </MotionFade>

              <MotionFade delay={0.16}>
                <p className="max-w-2xl text-lg text-white/85 sm:text-xl leading-relaxed">
                  Learnova gives you everything you need to study effectively — from Pomodoro focus sessions and
                  real practice quizzes to flashcards, notes, and personalised study plans.
                </p>
              </MotionFade>

              <MotionFade delay={0.24}>
                <div className="flex flex-col sm:flex-row gap-3 pt-3 w-full sm:w-auto">
                  <Link href="/sign-up" className="w-full sm:w-auto">
                    <motion.div
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    >
                      <Button
                        size="lg"
                        className="w-full h-14 px-8 text-base rounded-full bg-white text-brand hover:bg-white/95 shadow-md"
                      >
                        Get Started Free
                        <motion.span
                          className="ml-2 inline-block"
                          whileHover={{ x: 4 }}
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </motion.span>
                      </Button>
                    </motion.div>
                  </Link>
                  <a href="#how-it-works" className="w-full sm:w-auto">
                    <motion.div
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    >
                      <Button
                        variant="outline"
                        size="lg"
                        className="w-full h-14 px-8 text-base rounded-full bg-transparent text-white border border-white/30 hover:bg-white/10"
                      >
                        See How It Works
                      </Button>
                    </motion.div>
                  </a>
                </div>
              </MotionFade>
            </div>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────────── */}
        <section id="features" className="py-24">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <MotionFade>
              <div className="text-center mb-16">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything you need to excel</h2>
                <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                  A complete suite of tools designed to make studying efficient and enjoyable.
                </p>
              </div>
            </MotionFade>

            <MotionStagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <MotionStaggerItem key={f.title}>
                  <motion.div
                    whileHover={{ y: -4, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }}
                    className="glass-card rounded-2xl p-6 h-full"
                  >
                    <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${f.bg} ${f.color}`}>
                      <f.icon className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                  </motion.div>
                </MotionStaggerItem>
              ))}
            </MotionStagger>
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────────────────── */}
        <section id="how-it-works" className="py-24 bg-secondary/40 border-y border-border/40">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            <MotionFade>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Simple. Proven. Effective.</h2>
              <p className="text-muted-foreground mb-16">Built on time-tested study science, not gimmicks.</p>
            </MotionFade>
            <MotionStagger className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
              {HOW_IT_WORKS.map((item) => (
                <MotionStaggerItem key={item.step} className="flex flex-col items-center text-center gap-4">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-brand to-brand-deep flex items-center justify-center text-xl font-bold text-white shadow-[0_8px_24px_rgba(30,58,138,0.3)]">
                      {item.step}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{item.desc}</p>
                </MotionStaggerItem>
              ))}
            </MotionStagger>
          </div>
        </section>

        {/* ── About Us ────────────────────────────────────────────────────── */}
        <section id="about" className="py-24">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <MotionFade>
              <div className="text-center mb-16">
                <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-sm font-medium text-primary mb-4">
                  <Users className="mr-2 h-4 w-4" />
                  About Us
                </div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">The mind behind Learnova AI</h2>
                <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                  Built by a student, for students — with a mission to make quality tech education accessible to everyone, everywhere.
                </p>
              </div>
            </MotionFade>

            <MotionFade delay={0.1}>
              <div className="glass-card rounded-2xl p-6 mb-10 space-y-4 border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Brain className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">What is Learnova AI?</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  <span className="text-foreground font-semibold">Learnova AI</span> is a smart, all-in-one study platform
                  built for students of all ages and levels. It combines AI-powered tools with proven study techniques to help
                  you learn faster, stay focused, and actually remember what you study.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  {[
                    { icon: Brain,          label: "AI Study Assistant",  desc: "Chat with an AI tutor, generate notes, solve problems, and get instant explanations on any subject." },
                    { icon: Timer,          label: "Focus Studio",        desc: "Pomodoro timers with ambient sounds to keep you in deep work sessions without distractions." },
                    { icon: Target,         label: "Practice Quizzes",    desc: "Test yourself with AI-generated multiple-choice quizzes across any topic and difficulty." },
                    { icon: GraduationCap,  label: "Tech Courses",        desc: "Structured lessons on Robotics, Electronics, Python, C++, AI & ML, and Coding Basics." },
                    { icon: Globe,          label: "Language Practice",   desc: "Learn 12 languages including English, Chinese, Arabic, French, Japanese, and more." },
                    { icon: Layers,         label: "Flashcards & Planner", desc: "Create flashcard decks, set exam dates, and get a personalised day-by-day study schedule." },
                  ].map(({ icon: Icon, label, desc }) => (
                    <div key={label} className="flex items-start gap-3 rounded-xl bg-muted/40 p-3.5">
                      <Icon className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </MotionFade>

            <div className="grid gap-8 lg:grid-cols-2 items-start">
              {/* Founder card */}
              <MotionFade delay={0.15}>
                <div className="glass-card rounded-2xl p-8 space-y-6 h-full">
                  <div className="flex items-center gap-5 min-w-0">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-brand to-brand-deep flex items-center justify-center text-3xl font-bold text-white shadow-[0_12px_32px_rgba(30,58,138,0.3)] select-none shrink-0">
                      MI
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-2xl font-bold tracking-tight">Mohammed Isaba Islam</h3>
                      <p className="text-primary font-medium text-sm sm:text-base">Founder — Learnova AI</p>
                      <p className="text-brand-deep font-medium text-sm">CEO &amp; Co-Founder — RoboKids Academy</p>
                    </div>
                  </div>

                  <p className="text-muted-foreground leading-relaxed">
                    Mohammed Isaba Islam is a 16-year-old innovator from Bangladesh, currently based in
                    <span className="text-foreground font-medium"> Portugal</span>. Passionate about technology and education,
                    he built Learnova AI to give every student access to smarter, AI-powered study tools — regardless of where they live.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    His goal is to bridge the gap between modern AI technology and everyday student life, building products that
                    make learning faster, more personal, and genuinely enjoyable for students around the world.
                  </p>

                  <div className="flex flex-wrap gap-2.5 pt-2">
                    {[
                      { Icon: MapPin, label: "Bangladesh 🇧🇩 → Portugal 🇵🇹" },
                      { Icon: GraduationCap, label: "Born 23 May 2010" },
                      { Icon: Rocket, label: "Tech Entrepreneur" },
                      { Icon: Zap, label: "Young Entrepreneur" },
                    ].map(({ Icon, label }) => (
                      <div key={label} className="flex items-center gap-1.5 rounded-full bg-muted/60 border border-border px-3 py-1.5 text-xs font-medium">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </MotionFade>

              {/* Achievements + RoboKids */}
              <MotionFade delay={0.2} className="space-y-6">
                <div className="glass-card rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <Trophy className="h-5 w-5 text-amber-600" />
                    </div>
                    <h4 className="text-lg font-semibold">International Achievements</h4>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3 rounded-xl bg-amber-500/5 border border-amber-500/20 p-4">
                      <Award className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-700">🥇 Gold Medal — International Round</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          BYSIS (Bangladesh Youth Young Scientist &amp; Innovator Society)
                          — International Competition, <span className="text-foreground font-medium">Malaysia</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Representing Bangladesh on the international stage</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl bg-slate-500/5 border border-slate-500/20 p-4">
                      <Award className="h-5 w-5 text-slate-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-slate-600">🥈 Silver Medal — National Round</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          BYSIS — Bangladesh Youth Young Scientist &amp; Innovator Society
                          — <span className="text-foreground font-medium">National Round, Bangladesh</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-card rounded-2xl p-6 space-y-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-sky-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold">RoboKids Academy</h4>
                      <p className="text-sm text-muted-foreground">Shared business co-founded by Mohammed Isaba Islam</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    RoboKids Academy is a technology education academy dedicated to teaching the next generation of
                    innovators. Students learn hands-on skills across a wide range of disciplines:
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {["Coding", "Robotics", "Electronics", "AI & Machine Learning", "Python", "C++", "3D Design", "Innovation Projects"].map((tag) => (
                      <span key={tag} className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </MotionFade>
            </div>
          </div>
        </section>

        {/* ── Contact Us ──────────────────────────────────────────────────── */}
        <section id="contact" className="py-24 bg-secondary/40 border-t border-border/40">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <MotionFade>
              <div className="text-center mb-16">
                <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-sm font-medium text-primary mb-4">
                  <Phone className="mr-2 h-4 w-4" />
                  Contact Us
                </div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Get in touch</h2>
                <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                  Have questions about Learnova AI, Premium plans, or RoboKids Academy? Reach out — Mohammed will get back to you personally.
                </p>
              </div>
            </MotionFade>

            <MotionStagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
              <MotionStaggerItem>
                <a
                  href="https://wa.me/8801711388418"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-card rounded-2xl p-6 flex flex-col items-center text-center gap-4 group h-full min-w-0"
                >
                  <div className="h-14 w-14 rounded-2xl bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                    <MessageCircle className="h-7 w-7 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">WhatsApp</p>
                    <p className="text-muted-foreground text-sm mt-1">Message directly on WhatsApp</p>
                    <p className="text-green-700 font-medium mt-2 text-sm">+880 1711 388 418</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>Open WhatsApp</span>
                    <ExternalLink className="h-3 w-3" />
                  </div>
                </a>
              </MotionStaggerItem>

              <MotionStaggerItem>
                <a
                  href="https://www.instagram.com/robo_kids_academy?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-card rounded-2xl p-6 flex flex-col items-center text-center gap-4 h-full min-w-0"
                >
                  <div className="h-14 w-14 rounded-2xl bg-pink-500/10 flex items-center justify-center">
                    <svg className="h-7 w-7 text-pink-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-lg">Instagram</p>
                    <p className="text-muted-foreground text-sm mt-1">RoboKids Academy</p>
                  </div>
                </a>
              </MotionStaggerItem>

              <MotionStaggerItem>
                <a
                  href="https://www.facebook.com/profile.php?id=61584793285272"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-card rounded-2xl p-6 flex flex-col items-center text-center gap-4 h-full min-w-0"
                >
                  <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                    <svg className="h-7 w-7 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-lg">Facebook</p>
                    <p className="text-muted-foreground text-sm mt-1">RoboKids Academy</p>
                  </div>
                </a>
              </MotionStaggerItem>
            </MotionStagger>

            <p className="text-center text-sm text-muted-foreground mt-12">
              📍 Mohammed Isaba Islam is based in <span className="text-foreground font-medium">Portugal</span>, originally from <span className="text-foreground font-medium">Bangladesh 🇧🇩</span>.
              Response times may vary due to time zones.
            </p>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-background py-12">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-3 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-brand to-brand-deep flex items-center justify-center">
                  <Brain className="h-4 w-4 text-white" />
                </div>
                <span className="text-lg font-bold tracking-tight">Learnova AI</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI-powered study tools built for every student. Focus better, learn faster, go further.
              </p>
            </div>
            <div>
              <p className="font-semibold mb-3 text-sm">Quick Links</p>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <a href="#features"     className="hover:text-foreground transition-colors w-fit">Features</a>
                <a href="#how-it-works" className="hover:text-foreground transition-colors w-fit">How it Works</a>
                <a href="#about"        className="hover:text-foreground transition-colors w-fit">About Us</a>
                <a href="#contact"      className="hover:text-foreground transition-colors w-fit">Contact</a>
              </div>
            </div>
            <div>
              <p className="font-semibold mb-3 text-sm">Contact</p>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <a href="https://wa.me/8801711388418" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-foreground transition-colors w-fit">
                  <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
                </a>
                <a href="/privacy-policy" className="hover:text-foreground transition-colors w-fit">Privacy Policy</a>
                <a href="/support"        className="hover:text-foreground transition-colors w-fit">Support</a>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Learnova AI. Built by Mohammed Isaba Islam. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">CEO &amp; Co-Founder · RoboKids Academy</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
