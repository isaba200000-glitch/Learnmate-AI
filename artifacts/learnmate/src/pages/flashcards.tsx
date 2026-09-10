import { useState } from "react";
import {
  useListFlashcardDecks,
  useCreateFlashcardDeck,
  useGetFlashcardDeck,
  useCreateFlashcardDeckCard,
  getListFlashcardDecksQueryKey,
  getGetFlashcardDeckQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { MotionFade, MotionStagger, MotionStaggerItem } from "@/components/motion";
import { Layers, Plus, Search, Play, BookOpen, PlusCircle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";

export default function FlashcardsPage() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDeckOpen, setIsCreateDeckOpen] = useState(false);
  const [newDeckTitle, setNewDeckTitle] = useState("");
  const [newDeckSubject, setNewDeckSubject] = useState("");
  const [newDeckDesc, setNewDeckDesc] = useState("");
  const [reviewDeckId, setReviewDeckId] = useState<number | null>(null);
  const [addCardsDeck, setAddCardsDeck] = useState<{ id: number; title: string } | null>(null);

  const { data: decks, isLoading } = useListFlashcardDecks({
    query: { queryKey: getListFlashcardDecksQueryKey() }
  });

  const createDeck = useCreateFlashcardDeck();

  const handleCreateDeck = () => {
    if (!newDeckTitle) return;
    createDeck.mutate({
      data: {
        title: newDeckTitle,
        subject: newDeckSubject || undefined,
        description: newDeckDesc || undefined
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFlashcardDecksQueryKey() });
        setIsCreateDeckOpen(false);
        setNewDeckTitle("");
        setNewDeckSubject("");
        setNewDeckDesc("");
        toast({ title: "Deck created successfully!" });
      }
    });
  };

  const filteredDecks = decks?.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    (d.subject && d.subject.toLowerCase().includes(search.toLowerCase()))
  );

  if (reviewDeckId) {
    return <FlashcardReview deckId={reviewDeckId} onExit={() => setReviewDeckId(null)} />;
  }

  return (
    <MotionFade className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500 text-white shadow-[0_0_16px_rgba(168,85,247,0.4)]">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Flashcard Decks</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Master concepts through spaced repetition</p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="relative w-full md:w-56">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search decks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary/40 border-transparent focus-visible:border-primary/50 rounded-xl"
            />
          </div>
          <Dialog open={isCreateDeckOpen} onOpenChange={setIsCreateDeckOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0 rounded-full gradient-btn shadow-sm h-10">
                <Plus className="h-4 w-4 mr-2" /> New Deck
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Flashcard Deck</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input value={newDeckTitle} onChange={e => setNewDeckTitle(e.target.value)} placeholder="e.g. Biology 101 Midterm" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject (Optional)</label>
                  <Input value={newDeckSubject} onChange={e => setNewDeckSubject(e.target.value)} placeholder="e.g. Biology" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description (Optional)</label>
                  <Input value={newDeckDesc} onChange={e => setNewDeckDesc(e.target.value)} placeholder="Brief description…" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDeckOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateDeck} disabled={!newDeckTitle || createDeck.isPending}>Create Deck</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Decks List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      ) : filteredDecks?.length === 0 ? (
        <div className="text-center py-20 glass-card rounded-2xl border border-dashed border-border/40">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 mx-auto mb-4">
            <Layers className="h-8 w-8 text-purple-500/50" />
          </div>
          <h3 className="text-base font-semibold mb-1">No decks found</h3>
          <p className="text-muted-foreground text-sm mb-5">Create your first deck to start memorizing.</p>
          <Button onClick={() => setIsCreateDeckOpen(true)} className="gradient-btn rounded-full">
            <Plus className="h-4 w-4 mr-2" /> Create First Deck
          </Button>
        </div>
      ) : (
        <MotionStagger className="glass-card rounded-2xl divide-y divide-border/30 overflow-hidden">
          {filteredDecks?.map((deck, idx) => {
            const colors = [
              "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]",
              "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]",
              "bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.3)]",
              "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.3)]",
              "bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.3)]",
            ];
            const tileColor = colors[idx % colors.length];
            return (
              <MotionStaggerItem key={deck.id}>
                <motion.div
                  className="flex items-center gap-3 py-3.5 px-4 hover:bg-muted/20 transition-colors"
                  whileHover={{ x: 2 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${tileColor}`}>
                    <Layers className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{deck.title}</h3>
                      {deck.subject && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-primary/15 text-primary">
                          {deck.subject}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {deck.cardCount} {deck.cardCount === 1 ? "card" : "cards"}
                      {deck.description && ` · ${deck.description}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground rounded-full h-8 px-3 text-xs"
                      onClick={() => setAddCardsDeck({ id: deck.id, title: deck.title })}
                    >
                      <PlusCircle className="h-3.5 w-3.5 mr-1" /> Add
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-full px-4 h-8 gradient-btn text-xs"
                      onClick={() => setReviewDeckId(deck.id)}
                      disabled={deck.cardCount === 0}
                    >
                      <Play className="h-3.5 w-3.5 mr-1" fill="currentColor" /> Study
                    </Button>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </motion.div>
              </MotionStaggerItem>
            );
          })}
        </MotionStagger>
      )}

      <AddCardsDialog deck={addCardsDeck} onClose={() => setAddCardsDeck(null)} />
    </MotionFade>
  );
}

// Dialog for adding cards to a deck
function AddCardsDialog({
  deck,
  onClose,
}: {
  deck: { id: number; title: string } | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createCard = useCreateFlashcardDeckCard();
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [addedCount, setAddedCount] = useState(0);

  const handleAdd = () => {
    if (!deck || !front.trim() || !back.trim()) return;
    createCard.mutate(
      { id: deck.id, data: { front: front.trim(), back: back.trim() } },
      {
        onSuccess: () => {
          setFront("");
          setBack("");
          setAddedCount(c => c + 1);
          queryClient.invalidateQueries({ queryKey: getListFlashcardDecksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetFlashcardDeckQueryKey(deck.id) });
        },
        onError: () => {
          toast({ title: "Couldn't add the card. Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (addedCount > 0) {
        toast({ title: `Added ${addedCount} card${addedCount === 1 ? "" : "s"} 🎉` });
      }
      setFront("");
      setBack("");
      setAddedCount(0);
      onClose();
    }
  };

  return (
    <Dialog open={!!deck} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Cards{deck ? ` — ${deck.title}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Front (Question)</label>
            <Textarea
              value={front}
              onChange={e => setFront(e.target.value)}
              placeholder="e.g. What is photosynthesis?"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Back (Answer)</label>
            <Textarea
              value={back}
              onChange={e => setBack(e.target.value)}
              placeholder="e.g. The process plants use to convert sunlight into energy."
              rows={3}
            />
          </div>
          {addedCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {addedCount} card{addedCount === 1 ? "" : "s"} added this session — keep going!
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Done</Button>
          <Button onClick={handleAdd} disabled={!front.trim() || !back.trim() || createCard.isPending}>
            {createCard.isPending ? "Adding…" : "Add Card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sub-component for reviewing a deck
function FlashcardReview({ deckId, onExit }: { deckId: number, onExit: () => void }) {
  const { data: deck, isLoading } = useGetFlashcardDeck(deckId, {
    query: { queryKey: getGetFlashcardDeckQueryKey(deckId) }
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [finished, setFinished] = useState(false);

  const cards = deck?.cards || [];
  const currentCard = cards[currentIndex];

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 150);
    } else {
      setFinished(true);
    }
  };

  if (isLoading) {
    return <div className="flex h-[60vh] items-center justify-center px-4"><Skeleton className="h-[400px] w-full max-w-[600px] rounded-3xl" /></div>;
  }

  if (!deck) return null;

  if (cards.length === 0) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10">
          <Layers className="h-8 w-8 text-muted-foreground/30" />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-1">No cards in this deck yet</h2>
          <p className="text-sm text-muted-foreground">Add some cards first, then come back to study.</p>
        </div>
        <Button variant="outline" onClick={onExit} className="rounded-full px-6 border-border/60">Back to Decks</Button>
      </div>
    );
  }

  if (finished) {
    return (
      <MotionFade>
        <div className="flex h-[calc(100dvh-10rem)] items-center justify-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="text-center space-y-6 max-w-md"
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-purple-500/10 mx-auto mb-4 border border-purple-500/20 shadow-lg">
              <span className="text-4xl">🎉</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Deck Complete!</h2>
            <p className="text-muted-foreground">You've reviewed all {cards.length} cards in <span className="font-medium text-foreground">{deck.title}</span>.</p>
            <div className="flex justify-center gap-4 pt-4">
              <Button variant="outline" onClick={() => { setFinished(false); setCurrentIndex(0); setIsFlipped(false); }} className="rounded-full px-6 border-border/60">
                Review Again
              </Button>
              <Button onClick={onExit} className="rounded-full px-8 gradient-btn">Done</Button>
            </div>
          </motion.div>
        </div>
      </MotionFade>
    );
  }

  const progress = ((currentIndex) / cards.length) * 100;

  return (
    <div className="max-w-3xl mx-auto flex flex-col min-h-[70vh] md:min-h-0 md:h-[calc(100dvh-10rem)]">
      {/* Review Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500 text-white shadow-sm">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{deck.title}</h2>
            <p className="text-xs text-muted-foreground font-mono">Card {currentIndex + 1} of {cards.length}</p>
          </div>
        </div>
        <Button variant="ghost" onClick={onExit} className="rounded-full">Exit</Button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-secondary/60 mb-8">
        <motion.div
          className="h-full rounded-full bg-purple-500"
          style={{ width: `${progress}%` }}
          layout
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center relative mb-8">
        <motion.div
          className="w-full max-w-2xl aspect-[3/2] relative cursor-pointer"
          style={{ perspective: 1000 }}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <motion.div
            className="absolute inset-0 rounded-3xl glass-card border-2 border-border/50 shadow-xl p-10 flex flex-col items-center justify-center text-center backface-hidden"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground/50 text-xs font-semibold uppercase tracking-wider">
              <Layers className="h-3.5 w-3.5" /> Front
            </div>
            <p className="max-h-full overflow-y-auto text-2xl md:text-4xl font-semibold leading-tight text-foreground">{currentCard?.front}</p>
            <div className="absolute bottom-6 text-xs text-muted-foreground/60 font-medium">Tap to flip</div>
          </motion.div>

          <motion.div
            className="absolute inset-0 rounded-3xl border-2 border-primary/30 shadow-xl p-10 flex flex-col items-center justify-center text-center"
            style={{ background: 'hsl(var(--card))', backfaceVisibility: "hidden", rotateY: 180 }}
            animate={{ rotateY: isFlipped ? 0 : -180 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <div className="absolute inset-0 rounded-3xl bg-primary/5" />
            <div className="relative z-10 flex flex-col items-center justify-center w-full h-full">
              <div className="absolute top-6 left-6 flex items-center gap-2 text-primary/50 text-xs font-semibold uppercase tracking-wider">
                <BookOpen className="h-3.5 w-3.5" /> Back
              </div>
              <p className="max-h-full overflow-y-auto text-xl md:text-3xl font-medium leading-relaxed text-foreground">{currentCard?.back}</p>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-3 pb-8">
        <Button
          variant="outline"
          size="lg"
          className="w-36 h-12 rounded-full border-border/60"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          {isFlipped ? "Show Front" : "Show Back"}
        </Button>
        <Button
          size="lg"
          className="w-36 h-12 rounded-full gradient-btn"
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
          disabled={!isFlipped}
        >
          {currentIndex < cards.length - 1 ? "Next Card" : "Finish"}
        </Button>
      </div>
    </div>
  );
}
