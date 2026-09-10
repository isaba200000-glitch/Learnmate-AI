import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Search, BookOpen, Layers, Target, Loader2, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  useListNotes,
  useListFlashcardDecks,
  useListQuizSessions,
  getListNotesQueryKey,
  getListFlashcardDecksQueryKey,
  getListQuizSessionsQueryKey,
} from "@workspace/api-client-react";

function ResultItem({
  icon: Icon,
  title,
  subtitle,
  onSelect,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary/60"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/80 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </button>
  );
}

export default function GlobalSearch() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const enabled = debounced.length > 0;
  const { data: notes, isFetching: notesFetching } = useListNotes(
    { search: debounced || undefined },
    {
      query: {
        queryKey: getListNotesQueryKey({ search: debounced || undefined }),
        enabled,
      },
    }
  );
  const { data: decks } = useListFlashcardDecks({
    query: { queryKey: getListFlashcardDecksQueryKey(), enabled },
  });
  const { data: sessions } = useListQuizSessions({
    query: { queryKey: getListQuizSessionsQueryKey(), enabled },
  });

  const q = debounced.toLowerCase();
  const noteResults = (notes ?? []).slice(0, 5);
  const deckResults = (decks ?? [])
    .filter(d => d.title.toLowerCase().includes(q) || (d.subject ?? "").toLowerCase().includes(q))
    .slice(0, 3);
  const quizResults = (sessions ?? [])
    .filter(s => s.subject.toLowerCase().includes(q))
    .slice(0, 3);
  const hasResults = noteResults.length > 0 || deckResults.length > 0 || quizResults.length > 0;

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    setQuery("");
    navigate(path);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter") {
      if (noteResults.length > 0) go(`/notes?note=${noteResults[0].id}`);
      else if (deckResults.length > 0) go("/flashcards");
      else if (quizResults.length > 0) go("/quizzes");
    }
  };

  return (
    <div ref={containerRef} className="relative hidden w-64 md:block lg:w-96">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search notes, decks, quizzes..."
        className="h-9 w-full rounded-full bg-secondary/50 pl-9 border-transparent focus-visible:border-primary"
        aria-label="Search"
      />
      {open && enabled && (
        <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {notesFetching && !hasResults ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          ) : !hasResults ? (
            <div className="p-4 text-sm text-muted-foreground">No results for "{debounced}"</div>
          ) : (
            <div className="max-h-96 overflow-y-auto py-2">
              {noteResults.length > 0 && (
                <div>
                  <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Notes
                  </p>
                  {noteResults.map(n => (
                    <ResultItem
                      key={`note-${n.id}`}
                      icon={BookOpen}
                      title={n.title}
                      subtitle={n.subject ?? undefined}
                      onSelect={() => go(`/notes?note=${n.id}`)}
                    />
                  ))}
                </div>
              )}
              {deckResults.length > 0 && (
                <div>
                  <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Flashcard Decks
                  </p>
                  {deckResults.map(d => (
                    <ResultItem
                      key={`deck-${d.id}`}
                      icon={Layers}
                      title={d.title}
                      subtitle={`${d.cardCount} cards`}
                      onSelect={() => go("/flashcards")}
                    />
                  ))}
                </div>
              )}
              {quizResults.length > 0 && (
                <div>
                  <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Quizzes
                  </p>
                  {quizResults.map(s => (
                    <ResultItem
                      key={`quiz-${s.id}`}
                      icon={Target}
                      title={s.subject}
                      subtitle={`${s.totalQuestions} questions`}
                      onSelect={() => go("/quizzes")}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
