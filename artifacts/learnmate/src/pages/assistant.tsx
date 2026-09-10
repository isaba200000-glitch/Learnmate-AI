import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAssistantOverview,
  getGetAssistantOverviewQueryKey,
  useGetAssistantConversation,
  getGetAssistantConversationQueryKey,
  useDeleteAssistantConversation,
  type AssistantLimits,
  getAuthToken,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Markdown, extractOutline } from "@/components/markdown";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/api-url";
import { motion, AnimatePresence } from "framer-motion";
import { MotionFade, MotionStagger, MotionStaggerItem } from "@/components/motion";
import { SUBJECTS, promptsFor, surprisePrompt, QUICK_COMMANDS, type SubjectId } from "@/lib/prompts";
import {
  Bot,
  BookmarkPlus,
  Crown,
  History,
  Image,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
  Copy,
  RefreshCw,
  Check,
  Wand2,
  ListTree,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function AssistantPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const overview = useGetAssistantOverview({
    query: { queryKey: getGetAssistantOverviewQueryKey() },
  });
  const [limitsOverride, setLimitsOverride] = useState<AssistantLimits | null>(null);
  const limits = limitsOverride ?? overview.data?.limits;
  const conversations = overview.data?.conversations ?? [];

  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const [imageStates, setImageStates] = useState<Record<number, { loading: boolean; imageUrl?: string }>>({});
  const [savingToNotes, setSavingToNotes] = useState<Record<number, boolean>>({});
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [subject, setSubject] = useState<SubjectId>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const detail = useGetAssistantConversation(activeId ?? 0, {
    query: { queryKey: getGetAssistantConversationQueryKey(activeId ?? 0), enabled: activeId !== null },
  });
  const deleteConversation = useDeleteAssistantConversation();

  const savedMessages: ChatMessage[] =
    activeId !== null && detail.data
      ? detail.data.messages.map((m) => ({ role: m.role, content: m.content }))
      : [];
  const messages = [...savedMessages, ...draft];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, draft]);

  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => { setImageStates({}); }, [activeId]);

  const openConversation = (id: number | null) => {
    if (streaming) return;
    setActiveId(id);
    setDraft([]);
    setLimitHit(false);
    setHistoryOpen(false);
  };

  const saveToNotes = async (msgIndex: number, content: string, imageUrl: string) => {
    setSavingToNotes((s) => ({ ...s, [msgIndex]: true }));
    try {
      const firstSentenceMatch = content.match(/^[^.!?\n]+[.!?]?/);
      const title = (firstSentenceMatch ? firstSentenceMatch[0].trim() : content.slice(0, 80)).slice(0, 120);
      const noteContent = `![Visual explanation](${imageUrl})\n\n${content}`;

      const token = await getAuthToken();
      const res = await fetch(apiUrl("/notes"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ title, content: noteContent, tags: [] }),
      });

      if (!res.ok) throw new Error("failed");
      const note = (await res.json()) as { id: number };

      toast({
        title: "Saved to Notes",
        description: "Your AI explanation and image have been saved.",
        action: (
          <button
            onClick={() => setLocation(`/notes?note=${note.id}`)}
            className="text-xs font-medium underline underline-offset-2"
          >
            View note
          </button>
        ) as any,
      });
    } catch {
      toast({ title: "Could not save note. Please try again.", variant: "destructive" });
    } finally {
      setSavingToNotes((s) => ({ ...s, [msgIndex]: false }));
    }
  };

  const visualize = async (msgIndex: number, content: string) => {
    setImageStates((s) => ({ ...s, [msgIndex]: { loading: true } }));
    try {
      const token = await getAuthToken();
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 95_000);
      const res = await fetch(apiUrl("/assistant/visualize"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ message: content }),
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);
      const body = (await res.json().catch(() => ({}))) as { imageUrl?: string; error?: string };
      if (!res.ok || !body.imageUrl) {
        throw new Error(body.error ?? "Could not generate image. Please try again.");
      }
      setImageStates((s) => ({ ...s, [msgIndex]: { loading: false, imageUrl: body.imageUrl } }));
    } catch (err) {
      setImageStates((s) => ({ ...s, [msgIndex]: { loading: false } }));
      toast({
        title: "Image generation failed",
        description: err instanceof Error && err.name === "AbortError"
          ? "It took too long. Please try again."
          : err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || streaming) return;
    if (limits && limits.remaining !== null && limits.remaining <= 0) {
      setLimitHit(true);
      return;
    }
    setInput("");
    setStreaming(true);
    setDraft((d) => [...d, { role: "user", content: text }, { role: "assistant", content: "" }]);

    try {
      const token = await getAuthToken();
      const res = await fetch(apiUrl("/assistant/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ conversationId: activeId ?? undefined, message: text }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setDraft((d) => d.slice(0, -2));
        setInput(text);
        if (res.status === 403) {
          setLimitHit(true);
          setLimitsOverride((l) => l ?? (limits ? { ...limits, remaining: 0 } : null));
        } else {
          toast({ title: body?.error ?? "Something went wrong. Please try again.", variant: "destructive" });
        }
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("no stream");
      const decoder = new TextDecoder();
      let buffer = "";
      let newConversationId: number | null = null;
      let streamError: string | null = null;
      let gotDone = false;

      const handleEvent = (payload: string) => {
        const data = JSON.parse(payload) as {
          delta?: string;
          done?: boolean;
          conversationId?: number;
          limits?: AssistantLimits;
          error?: string;
        };
        if (data.delta) {
          setDraft((d) => {
            const last = d[d.length - 1];
            if (!last || last.role !== "assistant") return d;
            return [...d.slice(0, -1), { ...last, content: last.content + data.delta }];
          });
        }
        if (data.error) streamError = data.error;
        if (data.done) {
          gotDone = true;
          if (typeof data.conversationId === "number") newConversationId = data.conversationId;
          if (data.limits) setLimitsOverride(data.limits);
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (raw.startsWith("data: ")) handleEvent(raw.slice(6));
        }
      }

      if (streamError) {
        setDraft((d) => d.slice(0, -2));
        setInput(text);
        toast({ title: streamError, variant: "destructive" });
        return;
      }
      if (!gotDone) {
        toast({ title: "Connection interrupted — the answer may be incomplete.", variant: "destructive" });
        queryClient.invalidateQueries({ queryKey: getGetAssistantOverviewQueryKey() });
        return;
      }

      const finalId = newConversationId ?? activeId;
      await queryClient.invalidateQueries({ queryKey: getGetAssistantOverviewQueryKey() });
      if (finalId !== null) {
        await queryClient.invalidateQueries({ queryKey: getGetAssistantConversationQueryKey(finalId) });
        if (activeId === null) setActiveId(finalId);
      }
      setDraft([]);
    } catch {
      setDraft((d) => d.slice(0, -2));
      setInput(text);
      toast({ title: "Connection lost. Please try again.", variant: "destructive" });
    } finally {
      setStreaming(false);
    }
  };

  const lastUser = useMemo(
    () => [...messages].reverse().find((m) => m.role === "user"),
    [messages],
  );

  const regenerate = () => {
    if (lastUser && !streaming) send(lastUser.content);
  };

  const copyMessage = async (idx: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIdx(idx);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopiedIdx((v) => (v === idx ? null : v)), 1800);
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  const remainingText =
    limits && limits.remaining !== null
      ? `${limits.remaining} of ${limits.dailyLimit} free questions left today`
      : null;

  // Shared conversation list (used in both desktop sidebar and mobile drawer)
  const conversationList = useMemo(() => (
    <>
      <button
        onClick={() => openConversation(null)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl glass-card border-border/40 hover:bg-muted/20 transition-colors text-sm font-medium"
        data-testid="button-new-chat"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
          <MessageSquarePlus className="h-3.5 w-3.5" />
        </div>
        New chat
      </button>
      <div className="flex-1 space-y-0.5 overflow-y-auto min-w-0">
        {overview.isLoading ? (
          <div className="space-y-1.5 pt-1">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No chats yet</p>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-all hover:bg-muted/30 min-w-0",
                activeId === c.id && "bg-primary/10 text-primary",
              )}
            >
              <button
                onClick={() => openConversation(c.id)}
                className="min-w-0 flex-1 truncate text-left font-medium"
                data-testid={`button-conversation-${c.id}`}
              >
                {c.title}
              </button>
              <button
                onClick={() =>
                  !streaming &&
                  deleteConversation.mutate(
                    { conversationId: c.id },
                    {
                      onSuccess: () => {
                        if (activeId === c.id) openConversation(null);
                        queryClient.invalidateQueries({ queryKey: getGetAssistantOverviewQueryKey() });
                      },
                    },
                  )
                }
                className="opacity-0 transition-opacity group-hover:opacity-50 hover:!opacity-100 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive shrink-0"
                data-testid={`button-delete-conversation-${c.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </>
  ), [overview.isLoading, conversations, activeId, streaming, openConversation, deleteConversation, queryClient]);

  return (
    <div className="mx-auto flex h-[calc(100dvh-11rem)] md:h-[calc(100dvh-8rem)] w-full max-w-6xl gap-4">
      {/* ── Conversations sidebar (desktop only) ── */}
      <aside className="hidden w-56 shrink-0 flex-col gap-2 md:flex">
        <div className="flex items-center gap-2 mb-1 px-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Chats</span>
        </div>
        {conversationList}
      </aside>

      {/* ── Chat area ── */}
      <div className="flex min-w-0 flex-1 flex-col glass-card rounded-2xl overflow-hidden">
        {/* Chat Header — premium gradient icon + subject tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-4 py-3 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* History button — mobile only */}
            <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 rounded-lg" aria-label="Chat history">
                  <History className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col gap-3 p-4">
                <SheetHeader>
                  <SheetTitle className="text-left text-base">Chat history</SheetTitle>
                </SheetHeader>
                {conversationList}
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-3 min-w-0" data-testid="text-page-title">
              {/* Premium gradient ring avatar with status indicator */}
              <div className="relative shrink-0">
                <div
                  className={cn(
                    "absolute inset-0 rounded-2xl blur-md",
                    streaming ? "bg-primary/40 animate-pulse" : "bg-primary/20",
                  )}
                />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand via-brand-deep to-primary text-white shadow-[0_0_18px_rgba(37,99,235,0.45)] ring-1 ring-white/10">
                  <Bot className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                    streaming ? "bg-amber-400 animate-pulse" : "bg-emerald-500",
                  )}
                  aria-hidden
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold leading-none">AI Study Assistant</h1>
                <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Powered by AI · {streaming ? "Composing…" : "Ready"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {streaming && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Thinking…</span>
              </div>
            )}
            {remainingText && (
              <Badge
                variant={limits?.remaining === 0 ? "destructive" : "secondary"}
                className="text-xs"
                data-testid="badge-remaining"
              >
                {remainingText}
              </Badge>
            )}
          </div>
        </div>

        {/* Subject tabs */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-card/30 overflow-x-auto">
          <Tabs value={subject} onValueChange={(v) => setSubject(v as SubjectId)}>
            <TabsList className="bg-muted/30 border border-border/30 h-9">
              {SUBJECTS.map((s) => (
                <TabsTrigger
                  key={s.id}
                  value={s.id}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs h-7"
                  data-testid={`tab-subject-${s.id}`}
                >
                  <span className="mr-1.5">{s.emoji}</span>
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
          {messages.length === 0 && !detail.isLoading && (
            <MotionFade key={`empty-${subject}`}>
              <div className="flex h-full flex-col items-center justify-center gap-5 text-center py-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-3xl blur-xl bg-primary/30 animate-pulse" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand via-brand-deep to-primary text-white shadow-[0_8px_32px_-8px_rgba(37,99,235,0.6)] ring-1 ring-white/20">
                      <Sparkles className="h-10 w-10" />
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-xl">Ask me anything</p>
                    <p className="max-w-md text-sm text-muted-foreground mt-1.5 leading-relaxed">
                      Maths steps, science explanations, essay help, সৃজনশীল questions — in English or Bangla,
                      tuned to GCSE, A Level, SSC and HSC.
                    </p>
                  </div>
                </div>
                <MotionStagger key={`chips-${subject}`} className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {promptsFor(subject).map((p, i) => (
                    <MotionStaggerItem key={`${subject}-${i}-${p.text}`}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        onClick={() => setInput(p.text)}
                        className="text-left text-xs px-3 py-2.5 rounded-xl glass-card border-border/40 hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground font-medium flex items-center gap-2 w-full"
                      >
                        <span className="text-base shrink-0">{p.emoji}</span>
                        <span className="leading-snug">{p.text}</span>
                      </motion.button>
                    </MotionStaggerItem>
                  ))}
                </MotionStagger>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    const p = surprisePrompt();
                    setInput(p.text);
                  }}
                  className="text-xs font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
                  data-testid="button-surprise"
                >
                  <Wand2 className="h-3.5 w-3.5" /> Surprise me
                </motion.button>
              </div>
            </MotionFade>
          )}

          {detail.isLoading && (
            <div className="space-y-4">
              <div className="flex justify-start">
                <Skeleton className="h-16 w-2/3 rounded-2xl" />
              </div>
              <div className="flex justify-end">
                <Skeleton className="h-10 w-1/2 rounded-2xl" />
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <ChatBubble
              key={i}
              message={m}
              index={i}
              isLast={i === messages.length - 1}
              streaming={streaming}
              imageState={imageStates[i]}
              savingToNotes={savingToNotes[i]}
              copied={copiedIdx === i}
              onCopy={() => copyMessage(i, m.content)}
              onRegenerate={regenerate}
              onVisualize={() => visualize(i, m.content)}
              onSaveToNotes={(imageUrl) => saveToNotes(i, m.content, imageUrl)}
            />
          ))}
        </div>

        {/* Limit hit banner */}
        {limitHit && (
          <div className="mx-4 mb-2 rounded-xl glass-card border-amber-500/30 bg-amber-500/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3" data-testid="card-limit-upgrade">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                <Crown className="h-3.5 w-3.5" />
              </div>
              <p className="text-sm text-muted-foreground">
                Daily limit reached. <span className="font-semibold text-foreground">Premium gives you unlimited chat.</span>
              </p>
            </div>
            <Button asChild size="sm" className="rounded-full gradient-btn" data-testid="button-assistant-upgrade">
              <Link href="/premium">
                <Crown className="mr-1.5 h-3.5 w-3.5" /> Upgrade
              </Link>
            </Button>
          </div>
        )}

        {/* Quick commands + Input Area */}
        <div className="border-t border-border/40 p-3 bg-card/40 space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1" data-testid="quick-commands">
            {QUICK_COMMANDS.map((c) => (
              <motion.button
                key={c.id}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  setInput(c.prompt);
                }}
                disabled={streaming}
                className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border border-border/40 bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                data-testid={`quick-${c.id}`}
              >
                <span className="text-sm leading-none">{c.emoji}</span>
                {c.label}
              </motion.button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask a study question… (English or বাংলা)"
              className="max-h-32 min-h-[44px] flex-1 resize-none bg-secondary/30 border-border/40 focus-visible:border-primary/50 rounded-xl"
              data-testid="input-chat-message"
            />
            <Button
              onClick={() => send()}
              disabled={streaming || !input.trim()}
              className="h-11 shrink-0 rounded-xl gradient-btn shadow-sm px-4 gap-2"
              data-testid="button-send-message"
            >
              {streaming ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
              ) : (
                <><Send className="h-4 w-4" /> Send</>
              )}
            </Button>
          </div>
          {lastUser && !streaming && messages.length > 1 && (
            <div className="flex items-center justify-end">
              <button
                onClick={regenerate}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                data-testid="button-regenerate-input"
              >
                <RefreshCw className="h-3 w-3" /> Regenerate last answer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ChatBubble({
  message,
  index,
  isLast,
  streaming,
  imageState,
  savingToNotes,
  copied,
  onCopy,
  onRegenerate,
  onVisualize,
  onSaveToNotes,
}: {
  message: ChatMessage;
  index: number;
  isLast: boolean;
  streaming: boolean;
  imageState: { loading: boolean; imageUrl?: string } | undefined;
  savingToNotes: boolean | undefined;
  copied: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  onVisualize: () => void;
  onSaveToNotes: (imageUrl: string) => void;
}) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isStreamingThis = streaming && isLast && isAssistant && message.content === "";
  const isJustText = isAssistant && message.content && !imageState?.imageUrl;

  // Collapsible outline for long assistant answers
  const outline = useMemo(
    () => (isAssistant ? extractOutline(message.content) : []),
    [isAssistant, message.content],
  );
  const [outlineOpen, setOutlineOpen] = useState(false);
  const showOutline = isAssistant && outline.length >= 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex items-end gap-2", isUser ? "justify-end" : "justify-start")}
      data-testid={`message-${message.role}-${index}`}
    >
      {isAssistant && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand via-brand-deep to-primary text-white shadow-sm mb-0.5">
          <Bot className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm shadow-[0_0_12px_rgba(37,99,235,0.4)]"
            : "glass-card border-border/40 rounded-bl-sm",
        )}
      >
        {isUser ? (
          <p className="leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
        ) : isStreamingThis ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-pulse" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-pulse" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-pulse" style={{ animationDelay: "300ms" }} />
            </span>
            <span className="text-xs">Composing answer…</span>
          </div>
        ) : message.content ? (
          <>
            {/* Collapsible outline for long answers */}
            {showOutline && (
              <div className="mb-3 rounded-lg border border-border/30 bg-muted/20 overflow-hidden">
                <button
                  onClick={() => setOutlineOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-toggle-outline"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <ListTree className="h-3 w-3" />
                    Outline · {outline.length} {outline.length === 1 ? "section" : "sections"}
                  </span>
                  {outlineOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                <AnimatePresence initial={false}>
                  {outlineOpen && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="border-t border-border/30 px-3 py-2 space-y-1 overflow-hidden"
                    >
                      {outline.map((h, hi) => (
                        <li
                          key={hi}
                          className={cn(
                            "text-xs text-muted-foreground leading-snug",
                            h.level === 3 && "pl-4",
                          )}
                        >
                          <span className="text-primary mr-1.5">•</span>
                          {h.text}
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            )}

            <Markdown content={message.content} />

            {streaming && isLast && (
              <motion.span
                className="inline-block h-4 w-0.5 bg-primary ml-0.5 align-middle"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.75, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            {/* Per-message action toolbar — visible on hover (always visible on touch) */}
            {!streaming && (
              <div className="mt-2.5 pt-2 border-t border-border/20 flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
                <ActionButton
                  icon={copied ? Check : Copy}
                  label={copied ? "Copied" : "Copy"}
                  onClick={onCopy}
                  testId={`button-copy-${index}`}
                />
                {isLast && (
                  <ActionButton
                    icon={RefreshCw}
                    label="Regenerate"
                    onClick={onRegenerate}
                    testId={`button-regenerate-${index}`}
                  />
                )}
                {!imageState?.imageUrl && (
                  <ActionButton
                    icon={imageState?.loading ? Loader2 : Image}
                    label={imageState?.loading ? "Generating…" : "Visualize"}
                    onClick={onVisualize}
                    disabled={!!imageState?.loading}
                    testId={`button-visualize-${index}`}
                  />
                )}
                {imageState?.imageUrl && (
                  <ActionButton
                    icon={savingToNotes ? Loader2 : BookmarkPlus}
                    label={savingToNotes ? "Saving…" : "Save to Notes"}
                    onClick={() => onSaveToNotes(imageState.imageUrl!)}
                    disabled={!!savingToNotes}
                    testId={`button-save-${index}`}
                  />
                )}
              </div>
            )}

            {/* Visualize image (when present) */}
            {imageState?.imageUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="mt-3 overflow-hidden rounded-xl border border-border/40"
              >
                <img
                  src={imageState.imageUrl}
                  alt="visual explanation"
                  className="w-full rounded-xl"
                />
              </motion.div>
            )}
          </>
        ) : null}
      </div>
    </motion.div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  testId,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium",
        "text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
      )}
      data-testid={testId}
    >
      <Icon className={cn("h-3 w-3", Icon === Loader2 && "animate-spin")} />
      <span>{label}</span>
    </motion.button>
  );
}
