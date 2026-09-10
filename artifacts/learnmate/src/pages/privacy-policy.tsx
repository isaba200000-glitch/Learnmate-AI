import { Brain, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicyPage() {
  const lastUpdated = "29 July 2026";
  const contactEmail = "isaba200000@gmail.com";
  const whatsapp = "https://wa.me/8801711388418";

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

      {/* Content */}
      <main className="container mx-auto max-w-4xl px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {lastUpdated}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p>
              Welcome to <strong>Learnova AI</strong> ("we", "our", or "us"), an AI-powered educational
              platform built and operated by Mohammed Isaba Islam. This Privacy Policy explains how we
              collect, use, disclose, and protect your information when you use the Learnova AI mobile
              application and website (collectively, the "Service").
            </p>
            <p className="mt-3">
              By using Learnova AI, you agree to the collection and use of information as described in
              this policy. If you do not agree, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <h3 className="font-semibold mt-4 mb-2">2.1 Account Information</h3>
            <p>
              We use <strong>Clerk</strong> for authentication. When you create an account, Clerk collects
              your name, email address, and profile picture. We receive this information to identify your
              account within our Service.
            </p>
            <h3 className="font-semibold mt-4 mb-2">2.2 Study & Usage Data</h3>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Study notes, flashcards, quizzes, and documents you create</li>
              <li>Focus session durations and distraction events</li>
              <li>Language practice scores and exercise history</li>
              <li>AI Assistant conversation history</li>
              <li>Course progress and completion records</li>
              <li>Planner and exam schedule entries</li>
            </ul>
            <h3 className="font-semibold mt-4 mb-2">2.3 Payment Information</h3>
            <p>
              Premium subscriptions are processed through <strong>Whop</strong>. We do not store your
              card details. We receive confirmation of payment status from Whop to activate or maintain
              your Premium access.
            </p>
            <h3 className="font-semibold mt-4 mb-2">2.4 Device & Technical Data</h3>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Device type, operating system, and browser</li>
              <li>IP address and approximate location (country/region)</li>
              <li>App usage patterns and feature interactions</li>
              <li>Crash reports and error logs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Provide the Service</strong> — deliver AI tutoring, language practice, focus sessions, notes, and all other features</li>
              <li><strong>Personalise your experience</strong> — adapt difficulty levels, suggest content, and remember your preferences</li>
              <li><strong>Process payments</strong> — verify Premium subscriptions and manage access</li>
              <li><strong>Improve the Service</strong> — analyse aggregated usage to fix bugs and add new features</li>
              <li><strong>Send important notices</strong> — subscription reminders, policy updates, and security alerts</li>
              <li><strong>Safety & compliance</strong> — detect abuse, enforce our Terms of Service, and comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. AI Features & OpenAI</h2>
            <p>
              Learnova AI uses <strong>OpenAI</strong> to power the AI Assistant, Smart Notes, language
              exercises, and other AI features. Content you submit to these features (questions, notes,
              text) is sent to OpenAI for processing. OpenAI's use of this data is governed by their
              privacy policy at{" "}
              <a href="https://openai.com/privacy" target="_blank" rel="noopener noreferrer"
                className="text-primary underline">openai.com/privacy</a>.
              We do not sell your content to third parties for advertising.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Third-Party Services</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse mt-2">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold">Service</th>
                    <th className="text-left py-2 pr-4 font-semibold">Purpose</th>
                    <th className="text-left py-2 font-semibold">Privacy Policy</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  {[
                    ["Clerk", "User authentication & account management", "clerk.com/privacy"],
                    ["OpenAI", "AI tutoring, Smart Notes, language AI", "openai.com/privacy"],
                    ["Whop", "Premium payment processing", "whop.com/privacy"],
                  ].map(([name, purpose, url]) => (
                    <tr key={name} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium text-foreground">{name}</td>
                      <td className="py-2 pr-4">{purpose}</td>
                      <td className="py-2">
                        <a href={`https://${url}`} target="_blank" rel="noopener noreferrer"
                          className="text-primary underline">{url}</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
            <p>
              We retain your account and study data for as long as your account is active. AI Assistant
              conversation history may be automatically trimmed after 90 days to keep the app
              performant. If you delete your account, we will delete your personal data within 30 days,
              except where we are required by law to retain it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Children's Privacy</h2>
            <p>
              Learnova AI is designed to be used by students of all ages, including those under 13.
              We do not knowingly collect personal information from children under 13 without parental
              consent. If you are a parent or guardian and believe your child has provided personal
              information without your consent, please contact us immediately at the address below and
              we will delete that information promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Data Security</h2>
            <p>
              We implement industry-standard security measures including HTTPS encryption, secure
              authentication via Clerk, and access controls to protect your data. No method of
              transmission over the internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data ("right to be forgotten")</li>
              <li>Object to or restrict certain processing</li>
              <li>Data portability — receive your data in a machine-readable format</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, contact us using the details in Section 11.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant
              changes by posting the new policy in the app and updating the "Last updated" date at the
              top of this page. Continued use of the Service after changes constitutes acceptance of the
              updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
            <p>If you have any questions or requests about this Privacy Policy, please contact:</p>
            <div className="mt-3 p-4 rounded-lg border border-border bg-muted/30 space-y-1">
              <p><strong>Mohammed Isaba Islam</strong></p>
              <p>Founder — Learnova AI</p>
              <p>Email: <a href={`mailto:${contactEmail}`} className="text-primary underline">{contactEmail}</a></p>
              <p>WhatsApp: <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="text-primary underline">+880 1711 388 418</a></p>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-12">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Learnova AI · Mohammed Isaba Islam · All rights reserved.
        </div>
      </footer>
    </div>
  );
}
