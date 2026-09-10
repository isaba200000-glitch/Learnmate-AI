import { Brain, ArrowLeft, MessageCircle, Mail, HelpCircle, ChevronDown } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "How do I upgrade to Premium?",
    a: "Go to the Premium page inside the app and tap 'Upgrade to Premium'. You'll be taken to our secure payment page powered by Whop. Once payment is confirmed, Premium is activated instantly.",
  },
  {
    q: "What's included in the free plan?",
    a: "The free plan gives you access to the AI Tutor (limited sessions), basic Notes, Flashcards, and the Planner. Premium unlocks unlimited AI sessions, Smart Notes, Language Practice, Tech Courses, Focus Studio, and more.",
  },
  {
    q: "My payment went through but I'm still on the free plan. What should I do?",
    a: "This can happen if the payment confirmation was delayed. Please wait a few minutes and refresh the app. If your Premium isn't activated after 10 minutes, contact us on WhatsApp with your payment receipt and we'll sort it out immediately.",
  },
  {
    q: "How do I cancel my Premium subscription?",
    a: "You can cancel anytime from your Whop account at whop.com. After cancelling, you'll keep Premium access until the end of your current billing period.",
  },
  {
    q: "Is my study data safe?",
    a: "Yes. All data is stored securely and encrypted in transit. We never sell your personal data. See our Privacy Policy for full details.",
  },
  {
    q: "The Focus Mode keeps counting distractions when I lock my screen. Is that a bug?",
    a: "No — screen lock is intentionally excluded from distraction counting. Only switching to another app counts. This is by design so you can lock your screen without being penalised.",
  },
  {
    q: "The AI gave me a wrong answer. What should I do?",
    a: "AI can occasionally make mistakes, especially for complex topics. Always cross-check important answers with a textbook or teacher. You can report incorrect AI responses to us via WhatsApp so we can improve.",
  },
  {
    q: "Can I use Learnova AI offline?",
    a: "Most features (AI Tutor, Language Practice, Smart Notes) require an internet connection because they use AI processing. Basic notes and flashcard review may work partially offline.",
  },
  {
    q: "How do I delete my account?",
    a: "To delete your account and all associated data, contact us via WhatsApp or email. We'll process the deletion within 30 days as per our Privacy Policy.",
  },
  {
    q: "I have a feature suggestion. Where can I share it?",
    a: "We love hearing from students! Send your ideas via WhatsApp or email. Mohammed personally reads every suggestion.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border border-border rounded-lg overflow-hidden cursor-pointer"
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center justify-between gap-3 p-4">
        <p className="font-medium text-sm">{q}</p>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </div>
      {open && (
        <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <span className="font-bold">Learnova AI</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Support</h1>
        <p className="text-muted-foreground mb-10">
          We're here to help. Reach out directly or find answers below.
        </p>

        {/* Contact cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          <a href="https://wa.me/8801711388418" target="_blank" rel="noopener noreferrer">
            <Card className="h-full hover:border-green-500/50 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageCircle className="h-5 w-5 text-green-500" />
                  WhatsApp (Fastest)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>+880 1711 388 418</p>
                <p className="mt-1">Usually replies within a few hours.</p>
              </CardContent>
            </Card>
          </a>
          <a href="mailto:isaba200000@gmail.com">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-5 w-5 text-primary" />
                  Email
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>isaba200000@gmail.com</p>
                <p className="mt-1">For billing, account, or detailed issues.</p>
              </CardContent>
            </Card>
          </a>
        </div>

        {/* FAQ */}
        <div className="flex items-center gap-2 mb-6">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>

        {/* Still stuck */}
        <div className="mt-12 p-6 rounded-xl border border-border bg-muted/30 text-center">
          <p className="font-semibold mb-1">Still can't find what you need?</p>
          <p className="text-sm text-muted-foreground mb-4">
            Message Mohammed directly on WhatsApp — he personally handles all support.
          </p>
          <a href="https://wa.me/8801711388418" target="_blank" rel="noopener noreferrer">
            <Button className="gap-2">
              <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
            </Button>
          </a>
        </div>
      </main>

      <footer className="border-t border-border py-6 mt-12">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Learnova AI · Mohammed Isaba Islam · All rights reserved. ·{" "}
          <Link href="/privacy-policy" className="underline hover:text-foreground">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
