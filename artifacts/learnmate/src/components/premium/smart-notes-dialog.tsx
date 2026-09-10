import { useState } from "react";
import {
  useGenerateSmartNotes,
  useCreateNote,
  getListNotesQueryKey,
  type SmartNotesInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { Markdown } from "@/components/markdown";
import { Sparkles, FileText, Lightbulb, Copy, Check, Save, Wand2 } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";

type Mode = "generate" | "summarize" | "solve";

const MODES: { value: Mode; label: string; icon: typeof Sparkles; blurb: string }[] = [
  { value: "generate", label: "Generate", icon: Sparkles,   blurb: "Create clear study notes on any topic." },
  { value: "summarize", label: "Summarize", icon: FileText, blurb: "Condense long text into key points." },
  { value: "solve",     label: "Solve",     icon: Lightbulb, blurb: "Work through a problem step by step." },
];

interface SmartNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContent?: string;
  initialSubject?: string;
}

export function SmartNotesDialog({
  open,
  onOpenChange,
  initialContent = "",
  initialSubject = "",
}: SmartNotesDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const generate = useGenerateSmartNotes();
  const createNote = useCreateNote();
  const isMobile = useMediaQuery("(max-width: 639px)");

  const [mode, setMode] = useState<Mode>("generate");
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState(initialContent);
  const [subject, setSubject] = useState(initialSubject);
  const [result, setResult] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const activeMode = MODES.find((m) => m.value === mode)!;

  const canSubmit =
    mode === "generate" ? topic.trim().length > 0 : content.trim().length > 0;

  const handleGenerate = () => {
    if (!canSubmit) return;
    const payload: SmartNotesInput = {
      mode,
      topic:   topic.trim()   || undefined,
      content: content.trim() || undefined,
      subject: subject.trim() || undefined,
    };
    setResult("");
    generate.mutate(
      { data: payload },
      {
        onSuccess: (res) => setResult(res.result),
        onError: () =>
          toast({
            title: "Something went wrong",
            description: "Could not generate notes. Please try again.",
            variant: "destructive",
          }),
      },
    );
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const defaultTitle = () => {
    if (mode === "generate" && topic.trim()) return topic.trim();
    if (subject.trim()) return `${subject.trim()} — ${activeMode.label}`;
    return `AI ${activeMode.label} Notes`;
  };

  const handleSaveAsNote = () => {
    createNote.mutate(
      {
        data: {
          title:   defaultTitle().slice(0, 120),
          content: result,
          subject: subject.trim() || undefined,
          tags:    ["ai"],
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
          toast({ title: "Saved to your notes" });
          onOpenChange(false);
        },
        onError: () =>
          toast({ title: "Could not save note", variant: "destructive" }),
      },
    );
  };

  const resetAndClose = (v: boolean) => {
    if (!v) {
      setResult("");
      setCopied(false);
    }
    onOpenChange(v);
  };

  /* ─── shared inner content ─────────────────────────────────────── */
  const body = (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4 sm:p-6">

          {/* Mode tabs */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="grid w-full grid-cols-3">
              {MODES.map((m) => (
                <TabsTrigger key={m.value} value={m.value} className="gap-1.5 text-sm">
                  <m.icon className="h-4 w-4" />
                  {m.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Input fields */}
          <div className="space-y-4">
            {mode === "generate" ? (
              <div className="space-y-2">
                <Label htmlFor="sn-topic">Topic</Label>
                <Input
                  id="sn-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Photosynthesis, World War I, Quadratic equations"
                  className="text-base"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="sn-content">
                  {mode === "summarize" ? "Text to summarize" : "Problem or question"}
                </Label>
                <Textarea
                  id="sn-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    mode === "summarize"
                      ? "Paste the text or notes you want summarized..."
                      : "Type the question or problem you need solved..."
                  }
                  className="min-h-[180px] sm:min-h-[160px] resize-none text-base leading-relaxed"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="sn-subject">Subject (optional)</Label>
              <Input
                id="sn-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Biology, History, Mathematics"
                className="text-base"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!canSubmit || generate.isPending}
              className="w-full gap-2 rounded-xl h-12 text-base"
            >
              {generate.isPending ? (
                <><Spinner className="h-4 w-4" /> Working on it…</>
              ) : (
                <><Sparkles className="h-4 w-4" /> {activeMode.label} with AI</>
              )}
            </Button>
          </div>

          {/* Result */}
          {result && (
            <div className="space-y-3 rounded-2xl border border-border/60 bg-secondary/30 p-4 animate-in fade-in">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Result</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveAsNote}
                    disabled={createNote.isPending}
                    className="gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" /> Save as note
                  </Button>
                </div>
              </div>
              <Markdown content={result} className="rounded-lg bg-background p-4" />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  /* ─── shared header content ────────────────────────────────────── */
  const headerContent = (
    <>
      <div className="flex items-center gap-2 text-xl font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-600 text-white shadow-sm flex-shrink-0">
          <Wand2 className="h-4 w-4" />
        </span>
        Smart Notes Maker
      </div>
      <p className="text-sm text-muted-foreground mt-0.5">{activeMode.blurb}</p>
    </>
  );

  /* ─── mobile: bottom Sheet ──────────────────────────────────────── */
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={resetAndClose}>
        <SheetContent
          side="bottom"
          className="h-[95dvh] flex flex-col rounded-t-2xl p-0 gap-0"
        >
          <SheetHeader className="px-4 pt-5 pb-4 border-b border-border/50 bg-gradient-to-r from-primary/10 to-purple-500/10 flex-shrink-0 text-left">
            <SheetTitle asChild>
              <div>{headerContent}</div>
            </SheetTitle>
            <SheetDescription className="sr-only">{activeMode.blurb}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            {body}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  /* ─── desktop: Dialog ───────────────────────────────────────────── */
  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-hidden p-0 sm:max-w-2xl flex flex-col">
        <DialogHeader className="space-y-1 border-b border-border/50 bg-gradient-to-r from-primary/10 to-purple-500/10 p-6 flex-shrink-0">
          <DialogTitle asChild>
            <div>{headerContent}</div>
          </DialogTitle>
          <DialogDescription className="sr-only">{activeMode.blurb}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {body}
        </div>
      </DialogContent>
    </Dialog>
  );
}
