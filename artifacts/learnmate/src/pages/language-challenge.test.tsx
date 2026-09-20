/**
 * Duolingo-style additions to the language section: the two new exercise
 * drills (listening, match-the-pairs) and the daily challenge card.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────
// The page imports the generated client and app-wide providers at module load,
// so they have to be stubbed even though these tests only mount leaf widgets.

vi.mock("@workspace/api-client-react", () => ({
  useGetLanguageOverview: () => ({ data: undefined, isLoading: false }),
  getGetLanguageOverviewQueryKey: () => ["language-overview"],
  useLanguageTick: () => ({ mutate: vi.fn() }),
  useGenerateLanguageExercises: () => ({ mutate: vi.fn(), isPending: false }),
  useGradeLanguageSentence: () => ({ mutate: vi.fn(), isPending: false }),
  useGradeLanguageTranslation: () => ({ mutate: vi.fn(), isPending: false }),
  useCompleteLanguageExercise: () => ({ mutate: vi.fn() }),
}));

vi.mock("wouter", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/premium">{children}</a>,
  useLocation: () => ["/language", vi.fn()],
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

vi.mock("@/components/focus/focus-mode-card", () => ({ FocusModeButton: () => null }));

const { ListenExercise, MatchExercise, DailyChallengeCard, normalizeHeard } = await import(
  "./language"
);

// ── Speech synthesis stub ────────────────────────────────────────────────────

const speak = vi.fn();
const cancel = vi.fn();

function installSpeech() {
  vi.stubGlobal("speechSynthesis", { speak, cancel });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      text: string;
      lang = "";
      rate = 1;
      constructor(text: string) {
        this.text = text;
      }
    },
  );
}

beforeEach(() => {
  speak.mockClear();
  cancel.mockClear();
  installSpeech();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ── normalizeHeard ───────────────────────────────────────────────────────────

describe("normalizeHeard", () => {
  it("ignores case and surrounding whitespace", () => {
    expect(normalizeHeard("  Hola Mundo ")).toBe(normalizeHeard("hola mundo"));
  });

  it("ignores punctuation so a missing comma is not marked wrong", () => {
    expect(normalizeHeard("¿Cómo estás?")).toBe(normalizeHeard("como estas"));
  });

  it("ignores accents, which are hard to type on a phone keyboard", () => {
    expect(normalizeHeard("café")).toBe(normalizeHeard("cafe"));
  });

  it("collapses repeated spaces", () => {
    expect(normalizeHeard("je   suis  ici")).toBe("je suis ici");
  });

  it("still distinguishes genuinely different sentences", () => {
    expect(normalizeHeard("el gato")).not.toBe(normalizeHeard("el perro"));
  });

  it("keeps non-Latin scripts intact", () => {
    expect(normalizeHeard("これは本です。")).toBe("これは本です");
  });
});

// ── Listening exercise ───────────────────────────────────────────────────────

describe("ListenExercise", () => {
  const exercise = {
    type: "listen" as const,
    sentence: "El gato está en la mesa",
    translation: "The cat is on the table",
    glossary: [{ term: "gato", english: "cat" }],
  };

  it("plays the sentence automatically when it appears", () => {
    render(
      <ListenExercise
        exercise={exercise}
        language="Spanish"
        onAnswered={vi.fn()}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("does not reveal the sentence before the student answers", () => {
    render(
      <ListenExercise
        exercise={exercise}
        language="Spanish"
        onAnswered={vi.fn()}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect(screen.queryByText("El gato está en la mesa")).toBeNull();
  });

  it("replays on demand and offers a slower reading", () => {
    render(
      <ListenExercise
        exercise={exercise}
        language="Spanish"
        onAnswered={vi.fn()}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    speak.mockClear();
    fireEvent.click(screen.getByTestId("button-play-audio"));
    fireEvent.click(screen.getByTestId("button-play-slow"));
    expect(speak).toHaveBeenCalledTimes(2);
    const rates = speak.mock.calls.map((c) => (c[0] as { rate: number }).rate);
    expect(rates[1]).toBeLessThan(rates[0]);
  });

  it("uses the locale of the language being learned", () => {
    render(
      <ListenExercise
        exercise={exercise}
        language="Japanese"
        onAnswered={vi.fn()}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect((speak.mock.calls[0][0] as { lang: string }).lang).toBe("ja-JP");
  });

  it("accepts an answer that differs only by accents and punctuation", () => {
    const onAnswered = vi.fn();
    render(
      <ListenExercise
        exercise={exercise}
        language="Spanish"
        onAnswered={onAnswered}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    fireEvent.change(screen.getByTestId("input-listen-answer"), {
      target: { value: "el gato esta en la mesa!" },
    });
    fireEvent.click(screen.getByTestId("button-check-listen"));
    expect(onAnswered).toHaveBeenCalledWith(true);
  });

  it("marks a genuinely wrong answer and then shows the sentence", () => {
    const onAnswered = vi.fn();
    render(
      <ListenExercise
        exercise={exercise}
        language="Spanish"
        onAnswered={onAnswered}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    fireEvent.change(screen.getByTestId("input-listen-answer"), {
      target: { value: "el perro corre" },
    });
    fireEvent.click(screen.getByTestId("button-check-listen"));
    expect(onAnswered).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("panel-listen-result").textContent).toContain("El gato está en la mesa");
  });

  it("cannot be answered twice", () => {
    const onAnswered = vi.fn();
    render(
      <ListenExercise
        exercise={exercise}
        language="Spanish"
        onAnswered={onAnswered}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    fireEvent.change(screen.getByTestId("input-listen-answer"), {
      target: { value: "el gato esta en la mesa" },
    });
    fireEvent.click(screen.getByTestId("button-check-listen"));
    expect(screen.queryByTestId("button-check-listen")).toBeNull();
    expect(onAnswered).toHaveBeenCalledTimes(1);
  });

  it("falls back to showing the text when the browser has no speech synthesis", () => {
    vi.unstubAllGlobals();
    render(
      <ListenExercise
        exercise={exercise}
        language="Spanish"
        onAnswered={vi.fn()}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect(screen.getByTestId("text-speech-unsupported").textContent).toContain("El gato está en la mesa");
    expect(screen.queryByTestId("button-play-audio")).toBeNull();
  });

  it("stops the audio when the student moves on", () => {
    const { unmount } = render(
      <ListenExercise
        exercise={exercise}
        language="Spanish"
        onAnswered={vi.fn()}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});

// ── Match the pairs ──────────────────────────────────────────────────────────

describe("MatchExercise", () => {
  const exercise = {
    type: "match" as const,
    question: "Match the food words",
    pairs: [
      { term: "pan", english: "bread" },
      { term: "leche", english: "milk" },
      { term: "queso", english: "cheese" },
    ],
  };

  it("shows every word and every meaning", () => {
    render(
      <MatchExercise exercise={exercise} onAnswered={vi.fn()} onNext={vi.fn()} isLast={false} />,
    );
    for (const pair of exercise.pairs) {
      expect(screen.getByTestId(`button-match-term-${exercise.pairs.indexOf(pair)}`)).not.toBeNull();
    }
    expect(screen.getByText("bread")).not.toBeNull();
    expect(screen.getByText("milk")).not.toBeNull();
  });

  it("reports a perfect round when every pair is matched first try", () => {
    const onAnswered = vi.fn();
    render(
      <MatchExercise exercise={exercise} onAnswered={onAnswered} onNext={vi.fn()} isLast={false} />,
    );
    for (let i = 0; i < exercise.pairs.length; i++) {
      fireEvent.click(screen.getByTestId(`button-match-term-${i}`));
      fireEvent.click(screen.getByTestId(`button-match-meaning-${i}`));
    }
    expect(onAnswered).toHaveBeenCalledWith(true);
    expect(onAnswered).toHaveBeenCalledTimes(1);
  });

  it("counts a mismatch and reports the round as imperfect", () => {
    const onAnswered = vi.fn();
    render(
      <MatchExercise exercise={exercise} onAnswered={onAnswered} onNext={vi.fn()} isLast={false} />,
    );
    // Deliberately pair "pan" with the meaning of "leche".
    fireEvent.click(screen.getByTestId("button-match-term-0"));
    fireEvent.click(screen.getByTestId("button-match-meaning-1"));
    // Then finish correctly.
    for (let i = 0; i < exercise.pairs.length; i++) {
      fireEvent.click(screen.getByTestId(`button-match-term-${i}`));
      fireEvent.click(screen.getByTestId(`button-match-meaning-${i}`));
    }
    expect(onAnswered).toHaveBeenCalledWith(false);
  });

  it("ignores a meaning tapped before any word is selected", () => {
    const onAnswered = vi.fn();
    render(
      <MatchExercise exercise={exercise} onAnswered={onAnswered} onNext={vi.fn()} isLast={false} />,
    );
    fireEvent.click(screen.getByTestId("button-match-meaning-0"));
    expect(screen.queryByTestId("panel-match-result")).toBeNull();
    expect(onAnswered).not.toHaveBeenCalled();
  });

  it("disables a pair once it is matched so it cannot be re-scored", () => {
    render(
      <MatchExercise exercise={exercise} onAnswered={vi.fn()} onNext={vi.fn()} isLast={false} />,
    );
    fireEvent.click(screen.getByTestId("button-match-term-0"));
    fireEvent.click(screen.getByTestId("button-match-meaning-0"));
    expect((screen.getByTestId("button-match-term-0") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("button-match-meaning-0") as HTMLButtonElement).disabled).toBe(true);
  });

  it("lists every pair for review once the board is cleared", () => {
    render(
      <MatchExercise exercise={exercise} onAnswered={vi.fn()} onNext={vi.fn()} isLast={false} />,
    );
    for (let i = 0; i < exercise.pairs.length; i++) {
      fireEvent.click(screen.getByTestId(`button-match-term-${i}`));
      fireEvent.click(screen.getByTestId(`button-match-meaning-${i}`));
    }
    const panel = screen.getByTestId("panel-match-result");
    expect(panel.textContent).toContain("queso");
    expect(panel.textContent).toContain("cheese");
  });
});

// ── Daily challenge card ─────────────────────────────────────────────────────

describe("DailyChallengeCard", () => {
  const challenge = {
    kind: "exercises" as const,
    description: "Complete 10 exercises",
    target: 10,
    progress: 4,
    completed: false,
    xpReward: 20,
  };

  it("shows the goal, the progress and the reward", () => {
    render(
      <DailyChallengeCard challenge={challenge} level={3} xpIntoLevel={120} xpForNextLevel={300} />,
    );
    expect(screen.getByTestId("text-challenge-description").textContent).toContain("Complete 10 exercises");
    expect(screen.getByTestId("text-challenge-progress").textContent).toContain("4 / 10");
    expect(screen.getByTestId("card-daily-challenge").textContent).toContain("+20 XP");
  });

  it("fills the bar proportionally", () => {
    render(
      <DailyChallengeCard challenge={challenge} level={1} xpIntoLevel={0} xpForNextLevel={100} />,
    );
    expect((screen.getByTestId("bar-challenge-progress") as HTMLElement).style.width).toBe("40%");
  });

  it("never overflows the bar if progress somehow exceeds the target", () => {
    render(
      <DailyChallengeCard
        challenge={{ ...challenge, progress: 25 }}
        level={1}
        xpIntoLevel={0}
        xpForNextLevel={100}
      />,
    );
    expect((screen.getByTestId("bar-challenge-progress") as HTMLElement).style.width).toBe("100%");
  });

  it("celebrates a completed challenge", () => {
    render(
      <DailyChallengeCard
        challenge={{ ...challenge, progress: 10, completed: true }}
        level={2}
        xpIntoLevel={50}
        xpForNextLevel={200}
      />,
    );
    expect(screen.getByTestId("card-daily-challenge").textContent).toContain("Done");
  });

  it("shows the current level and XP towards the next one", () => {
    render(
      <DailyChallengeCard challenge={challenge} level={5} xpIntoLevel={220} xpForNextLevel={500} />,
    );
    expect(screen.getByTestId("text-level").textContent).toContain("Level 5");
    expect(screen.getByTestId("card-daily-challenge").textContent).toContain("220 / 500 XP");
  });
});
