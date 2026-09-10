import { useListNotes, useCreateNote, useUpdateNote, useDeleteNote, getListNotesQueryKey, getGetDashboardQueryKey, getAuthToken } from "@workspace/api-client-react";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { apiUrl } from "@/lib/api-url";
import { Markdown } from "@/components/markdown";
import { motion } from "framer-motion";

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(apiUrl(url), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((body as { error?: string }).error ?? "Request failed"), { status: res.status });
  return body as T;
}
import { usePremium } from "@/hooks/use-premium";
import { SmartNotesDialog } from "@/components/premium/smart-notes-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { FocusModeButton } from "@/components/focus/focus-mode-card";
import { Search, Plus, Trash2, Edit3, Save, X, BookOpen, Clock, Wand2, Crown, ChevronRight, FileText } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";

export default function NotesPage() {
  const [search, setSearch] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isPremium } = usePremium();
  const [, setLocation] = useLocation();
  const [smartOpen, setSmartOpen] = useState(false);

  const { data: notes, isLoading } = useListNotes({ search: search || undefined }, {
    query: {
      queryKey: getListNotesQueryKey({ search: search || undefined })
    }
  });

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSubject, setEditSubject] = useState("");

  const selectedNote = notes?.find(n => n.id === selectedNoteId);

  // Derive a subject key for the image (subject if set, else first 3 words of title)
  const noteSubjectKey = selectedNote
    ? (selectedNote.subject?.trim() || selectedNote.title.split(" ").slice(0, 3).join(" "))
    : null;

  const noteImageQuery = useQuery<{ imageUrl: string; photographerName?: string | null; photographerUrl?: string | null }>({
    queryKey: ["notes", "image", noteSubjectKey],
    queryFn: () => apiFetch(`/notes/image?subject=${encodeURIComponent(noteSubjectKey!)}`),
    staleTime: Infinity,
    retry: false,
    enabled: !!noteSubjectKey && !!selectedNote && !isEditing && !isCreating,
  });

  useEffect(() => {
    if (selectedNote && !isCreating) {
      setEditTitle(selectedNote.title);
      setEditContent(selectedNote.content);
      setEditSubject(selectedNote.subject || "");
    }
  }, [selectedNote, isCreating]);

  // Deep-link support: /notes?note=<id>
  const searchString = useSearch();
  const appliedNoteParam = useRef<string | null>(null);
  useEffect(() => {
    const noteParam = new URLSearchParams(searchString).get("note");
    if (!noteParam || noteParam === appliedNoteParam.current || !notes) return;
    const id = parseInt(noteParam, 10);
    if (!Number.isNaN(id) && notes.some(n => n.id === id)) {
      appliedNoteParam.current = noteParam;
      setSelectedNoteId(id);
      setIsEditing(false);
      setIsCreating(false);
    }
  }, [searchString, notes]);

  // On small screens, scroll editor into view on selection
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if ((selectedNoteId !== null || isCreating) && window.matchMedia("(max-width: 767px)").matches) {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedNoteId, isCreating]);

  const handleCreateNew = () => {
    setIsCreating(true);
    setIsEditing(true);
    setSelectedNoteId(null);
    setEditTitle("");
    setEditContent("");
    setEditSubject("");
  };

  const handleSmartNotes = () => {
    if (isPremium) {
      setSmartOpen(true);
    } else {
      setLocation("/premium");
    }
  };

  const handleSave = () => {
    if (!editTitle.trim() || !editContent.trim()) {
      toast({ title: "Validation Error", description: "Title and content are required.", variant: "destructive" });
      return;
    }
    if (isCreating) {
      createNote.mutate({ data: { title: editTitle, content: editContent, subject: editSubject || undefined, tags: [] } }, {
        onSuccess: (newNote) => {
          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          setIsCreating(false);
          setIsEditing(false);
          setSelectedNoteId(newNote.id);
          toast({ title: "Note created · +5 XP" });
        }
      });
    } else if (selectedNoteId) {
      updateNote.mutate({ id: selectedNoteId, data: { title: editTitle, content: editContent, subject: editSubject || undefined } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
          setIsEditing(false);
          toast({ title: "Note updated" });
        }
      });
    }
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this note?")) {
      deleteNote.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
          if (selectedNoteId === id) { setSelectedNoteId(null); setIsEditing(false); }
          toast({ title: "Note deleted" });
        }
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col space-y-6 md:h-[calc(100dvh-8rem)]"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-white shadow-[0_0_16px_rgba(59,130,246,0.4)]">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notes</h1>
            {notes && notes.length > 0 && (
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{notes.length} total</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <FocusModeButton />
          <Button variant="outline" onClick={handleSmartNotes} className="gap-1.5 rounded-full border-border/60">
            <Wand2 className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">Smart Notes</span>
            <span className="sm:hidden">Smart</span>
            {!isPremium && <Crown className="h-3.5 w-3.5 text-amber-500" />}
          </Button>
          <Button onClick={handleCreateNew} className="gap-1.5 rounded-full gradient-btn shadow-sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Note</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:flex-1 md:min-h-0 md:overflow-hidden">
        {/* Sidebar */}
        <div className="flex max-h-[50vh] flex-col gap-3 overflow-hidden rounded-2xl glass-card p-4 md:max-h-none">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary/40 border-transparent focus-visible:border-primary/50 rounded-xl"
            />
          </div>

          <ScrollArea className="flex-1 -mx-1 px-1">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : notes?.length === 0 ? (
              <div className="text-center py-10 px-4 text-muted-foreground">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 mx-auto mb-3">
                  <BookOpen className="h-7 w-7 text-blue-500/50" />
                </div>
                <p className="text-sm font-medium mb-3">No notes found</p>
                <Button onClick={handleCreateNew} variant="outline" size="sm" className="rounded-full border-border/60">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Note
                </Button>
              </div>
            ) : (
              <div className="space-y-1 pb-4">
                {notes?.map((note) => (
                  <div
                    key={note.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => { setSelectedNoteId(note.id); setIsEditing(false); setIsCreating(false); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedNoteId(note.id);
                        setIsEditing(false);
                        setIsCreating(false);
                      }
                    }}
                    className={`group w-full cursor-pointer text-left flex items-center gap-3 py-3 px-3 rounded-xl transition-all border-l-2 hover:bg-muted/30 ${
                      selectedNoteId === note.id
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent hover:border-primary/30'
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm ${selectedNoteId === note.id ? 'bg-blue-500' : 'bg-blue-500/70'}`}>
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm line-clamp-1 mb-0.5">{note.title}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        {note.subject && (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-primary/15 text-primary">
                            {note.subject}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {format(new Date(note.createdAt), "MMM d")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleDelete(note.id, e)}
                        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Editor Area */}
        <div ref={editorRef} className="md:col-span-2 rounded-2xl glass-card overflow-hidden flex flex-col min-h-[60vh] md:min-h-0">
          {isEditing || isCreating ? (
            <motion.div
              key="edit"
              initial={{ opacity: 0, scale: 0.97, filter: "blur(8px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col h-full"
            >
              {/* Editor Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-white">
                    <Edit3 className="h-4 w-4" />
                  </div>
                  <h2 className="font-semibold text-base">{isCreating ? "New Note" : "Edit Note"}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-full border-border/60" onClick={() => {
                    if (isCreating) { setIsCreating(false); setIsEditing(false); } else { setIsEditing(false); }
                  }}>
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" className="rounded-full gradient-btn" onClick={handleSave} disabled={createNote.isPending || updateNote.isPending}>
                    <Save className="h-4 w-4 mr-1" /> Save
                  </Button>
                </div>
              </div>
              <div className="flex flex-col flex-1 gap-3 p-6">
                <Input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="Note Title"
                  className="text-lg font-semibold px-4 py-5 bg-secondary/30 border-border/40"
                />
                <Input
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                  placeholder="Subject (Optional)"
                  className="w-full sm:w-1/2 bg-secondary/30 border-border/40"
                />
                <Textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  placeholder="Start typing your notes here…"
                  className="flex-1 resize-none p-4 text-base leading-relaxed min-h-[300px] md:min-h-0 bg-secondary/20 border-border/40"
                />
              </div>
            </motion.div>
          ) : selectedNote ? (
            <motion.div
              key="view"
              initial={{ opacity: 0, scale: 0.97, filter: "blur(8px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col h-full"
            >
              {/* Note Header */}
              <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border/40 px-6 py-4 flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold tracking-tight mb-1.5 break-words">{selectedNote.title}</h2>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                    {selectedNote.subject && (
                      <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary text-xs font-bold uppercase tracking-wide">
                        {selectedNote.subject}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {format(new Date(selectedNote.createdAt), "MMMM d, yyyy")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" className="rounded-full border-border/60" onClick={() => setIsEditing(true)}>
                    <Edit3 className="h-4 w-4 mr-1.5" /> Edit
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="prose prose-sm max-w-none pb-8 break-words [overflow-wrap:anywhere] px-6 md:px-8 pt-6">
                  {/* AI-generated subject illustration */}
                  {noteImageQuery.data?.imageUrl && (
                    <div className="not-prose mb-6 overflow-hidden rounded-2xl relative">
                      <img
                        src={noteImageQuery.data.imageUrl}
                        alt={selectedNote.subject || selectedNote.title}
                        className="h-44 w-full object-cover"
                      />
                      {/* Pexels licence attribution */}
                      {noteImageQuery.data.photographerName && (
                        noteImageQuery.data.photographerUrl ? (
                          <a
                            href={noteImageQuery.data.photographerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute bottom-1 left-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[9px] leading-none text-white/90 hover:underline"
                          >
                            Photo: {noteImageQuery.data.photographerName} · Pexels
                          </a>
                        ) : (
                          <span className="absolute bottom-1 left-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[9px] leading-none text-white/90">
                            Photo: {noteImageQuery.data.photographerName} · Pexels
                          </span>
                        )
                      )}
                    </div>
                  )}
                  {noteImageQuery.isLoading && (
                    <Skeleton className="not-prose mb-6 h-44 w-full rounded-2xl" />
                  )}
                  <Markdown content={selectedNote.content} />
                </div>
              </ScrollArea>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.97, filter: "blur(8px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex h-full flex-col items-center justify-center text-center p-8 text-muted-foreground"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
                <BookOpen className="h-10 w-10 text-blue-500/40" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1.5">Select a note</h3>
              <p className="max-w-xs text-sm">Choose a note from the list to read or edit it, or create a new one.</p>
              <Button onClick={handleCreateNew} className="mt-6 gap-2 rounded-full gradient-btn">
                <Plus className="h-4 w-4" /> Create Note
              </Button>
            </motion.div>
          )}
        </div>
      </div>

      {smartOpen && (
        <SmartNotesDialog
          open={smartOpen}
          onOpenChange={setSmartOpen}
          initialContent={selectedNote && !isCreating ? selectedNote.content : ""}
          initialSubject={selectedNote && !isCreating ? selectedNote.subject || "" : ""}
        />
      )}
    </motion.div>
  );
}
