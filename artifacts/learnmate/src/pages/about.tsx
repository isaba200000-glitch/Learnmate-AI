import {
  Trophy, Award, MapPin, Rocket, Globe, GraduationCap,
  MessageCircle, ExternalLink, Brain, Zap,
  Timer, Target, Layers, Cpu, Languages,
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="space-y-8 pb-10">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">About Us</h1>
        <p className="mt-1 text-muted-foreground">
          The story behind Learnova AI and the team building it.
        </p>
      </div>

      {/* ── What is Learnova AI ── */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold">What is Learnova AI?</h2>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          <span className="text-foreground font-semibold">Learnova AI</span> is a smart, all-in-one study platform
          built for students of all ages and levels. It combines AI-powered tools with proven study techniques to help
          you learn faster, stay focused, and actually remember what you study.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: Brain,    label: "AI Study Assistant",  desc: "Chat with an AI tutor, generate notes, solve problems, and get instant explanations on any subject." },
            { icon: Timer,    label: "Focus Studio",         desc: "Pomodoro timers with ambient sounds to keep you in deep work sessions without distractions." },
            { icon: Target,   label: "Practice Quizzes",     desc: "AI-generated multiple-choice quizzes across any topic and difficulty level." },
            { icon: Cpu,      label: "Tech Courses",         desc: "Structured lessons on Robotics, Electronics, Python, C++, AI & ML, and Coding Basics." },
            { icon: Languages,label: "Language Practice",    desc: "Learn 12 languages including English, Chinese, Arabic, French, Japanese, and more." },
            { icon: Layers,   label: "Flashcards & Planner", desc: "Create flashcard decks, set exam dates, and get a personalised day-by-day study schedule." },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3 rounded-xl bg-background/60 border border-border/50 p-3">
              <Icon className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Founder ── */}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-sky-500 flex items-center justify-center text-3xl font-bold text-white shadow-lg select-none flex-shrink-0">
            MI
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Mohammed Isaba Islam</h2>
            <p className="text-primary font-medium text-sm mt-0.5">Founder — Learnova AI</p>
            <p className="text-primary/80 font-medium text-sm">CEO & Co-Founder — RoboKids Academy</p>
          </div>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          Mohammed Isaba Islam is a young innovator from Bangladesh, currently based in{" "}
          <span className="text-foreground font-medium">Portugal</span>. Passionate about technology
          and education, he built Learnova AI to give every student access to smarter, AI-powered
          study tools — regardless of where they live.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          His goal is to bridge the gap between modern AI technology and everyday student life,
          building products that make learning faster, more personal, and genuinely enjoyable for
          students around the world.
        </p>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-full bg-secondary border border-border px-3 py-1.5 text-sm">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span>Bangladesh 🇧🇩 → Portugal 🇵🇹</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-secondary border border-border px-3 py-1.5 text-sm">
            <GraduationCap className="h-3.5 w-3.5 text-primary" />
            <span>Born 23 May 2010</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-secondary border border-border px-3 py-1.5 text-sm">
            <Rocket className="h-3.5 w-3.5 text-primary" />
            <span>Tech Entrepreneur</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-secondary border border-border px-3 py-1.5 text-sm">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span>Young Entrepreneur</span>
          </div>
        </div>
      </div>

      {/* ── Achievements ── */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold">International Achievements</h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4">
            <Award className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-400">🥇 Gold Medal — International Round</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                BYSIS (Bangladesh Youth Young Scientist & Innovator Society) —
                International Competition, <span className="text-foreground font-medium">Malaysia</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Representing Bangladesh on the international stage</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-slate-500/10 border border-slate-500/20 p-4">
            <Award className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-300">🥈 Silver Medal — National Round</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                BYSIS — Bangladesh Youth Young Scientist & Innovator Society —
                <span className="text-foreground font-medium"> National Round, Bangladesh</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── RoboKids Academy ── */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
            <Globe className="h-5 w-5 text-sky-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">RoboKids Academy</h2>
            <p className="text-sm text-muted-foreground">Co-founded by Mohammed Isaba Islam</p>
          </div>
        </div>
        <p className="text-muted-foreground leading-relaxed text-sm">
          RoboKids Academy is a technology education academy dedicated to teaching the next generation
          of innovators. Students learn hands-on skills across a wide range of disciplines:
        </p>
        <div className="flex flex-wrap gap-2">
          {["Coding", "Robotics", "Electronics", "AI & Machine Learning", "Python", "C++", "3D Design", "Innovation Projects"].map(tag => (
            <span key={tag} className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* ── Contact ── */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-green-500" />
          </div>
          <h2 className="text-xl font-bold">Contact Us</h2>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Have questions about Learnova AI, Premium plans, or RoboKids Academy? Reach out — Mohammed will get back to you personally.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {/* WhatsApp */}
          <a
            href="https://wa.me/8801711388418"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-xl border border-green-500/20 bg-green-500/5 p-4 transition-all hover:bg-green-500/10 group"
          >
            <div className="h-11 w-11 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-green-500/20 transition-colors">
              <MessageCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="overflow-hidden">
              <p className="font-semibold text-sm">WhatsApp</p>
              <p className="text-green-400 text-sm font-medium">+880 1711 388 418</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                Open chat <ExternalLink className="h-3 w-3" />
              </p>
            </div>
          </a>

          {/* Instagram */}
          <a href="https://www.instagram.com/robo_kids_academy?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-xl border border-pink-500/20 bg-pink-500/5 p-4 hover:border-pink-500/50 transition-colors">
            <div className="h-11 w-11 rounded-xl bg-pink-500/10 flex items-center justify-center flex-shrink-0">
              <svg className="h-5 w-5 text-pink-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm">Instagram</p>
              <p className="text-sm text-muted-foreground">RoboKids Academy</p>
            </div>
          </a>

          {/* Facebook */}
          <a href="https://www.facebook.com/profile.php?id=61584793285272" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-xl border border-blue-600/20 bg-blue-600/5 p-4 hover:border-blue-500/50 transition-colors">
            <div className="h-11 w-11 rounded-xl bg-blue-600/10 flex items-center justify-center flex-shrink-0">
              <svg className="h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm">Facebook</p>
              <p className="text-sm text-muted-foreground">RoboKids Academy</p>
            </div>
          </a>
        </div>

        <p className="text-xs text-muted-foreground text-center pt-1">
          📍 Based in <span className="text-foreground font-medium">Portugal</span>, originally from <span className="text-foreground font-medium">Bangladesh 🇧🇩</span>. Response times may vary due to time zones.
        </p>
      </div>

    </div>
  );
}
