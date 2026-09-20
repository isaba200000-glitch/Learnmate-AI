/**
 * Exam detail page — the part of "make exam prep actually useful" the student
 * sees. Verifies the real exam facts are rendered, the premium AI briefing is
 * gated rather than erroring, and a generated briefing displays.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ────────────────────────────────────────────────────────────────────

const EXAM = {
  id: "sat",
  name: "SAT",
  fullName: "Scholastic Assessment Test (Digital SAT)",
  category: "College Admission (USA)",
  description: "Digital, section-adaptive admissions test for US colleges",
  format: "Fully digital in the Bluebook app. Section-adaptive.",
  totalTime: "2 hours 14 minutes (plus a 10-minute break)",
  totalQuestions: "98",
  scoring: "400-1600 total (200-800 per section).",
  validity: "Accepted for up to 5 years.",
  sections: [
    { name: "Reading and Writing", questions: "54", minutes: "2 modules x 32", detail: "Short passages." },
    { name: "Math", questions: "44", minutes: "2 modules x 35", detail: "Desmos calculator available." },
  ],
  topics: [
    { area: "Craft and Structure", weight: "28%", items: ["Words in context", "Text structure"] },
    { area: "Algebra", items: ["Linear equations"] },
  ],
  keyFacts: ["There is no essay on the digital SAT."],
  studyTips: ["Practise in Bluebook itself."],
  officialSite: "https://satsuite.collegeboard.org/sat",
  lastVerified: "2026-09-20",
};

let examQuery: { data?: unknown; isLoading: boolean; isError: boolean } = {
  data: EXAM,
  isLoading: false,
  isError: false,
};
const deepDiveMutate = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  useGetExamType: () => examQuery,
  getGetExamTypeQueryKey: (id: string) => ["exam-type", id],
  useGenerateExamDeepDive: () => ({ mutate: deepDiveMutate, isPending: false }),
}));

const setLocationMock = vi.fn();
vi.mock("wouter", () => ({
  useRoute: () => [true, { examId: "sat" }],
  useLocation: () => ["/exam-prep/sat", setLocationMock],
  // PremiumGate renders a <Link href="/premium">.
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

let premiumState = { isPremium: true, isLoadingPremium: false };
vi.mock("@/hooks/use-premium", () => ({ usePremium: () => premiumState }));

import ExamDetailPage from "./exam-detail";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ExamDetailPage />
    </QueryClientProvider>,
  );
}

function clickTestId(id: string) {
  act(() => {
    screen.getByTestId(id).click();
  });
}

beforeEach(() => {
  premiumState = { isPremium: true, isLoadingPremium: false };
  examQuery = { data: EXAM, isLoading: false, isError: false };
  deepDiveMutate.mockReset();
  setLocationMock.mockReset();
});
afterEach(cleanup);

describe("Exam detail — real exam information", () => {
  it("shows the exam name, timing, question count and scoring", () => {
    renderPage();
    expect(screen.getByTestId("text-exam-name").textContent).toBe("SAT");
    const body = screen.getByTestId("page-exam-detail").textContent ?? "";
    expect(body).toContain("2 hours 14 minutes");
    expect(body).toContain("98");
    expect(body).toContain("400-1600");
  });

  it("lists every exam section with its timing", () => {
    renderPage();
    const sections = screen.getByTestId("card-exam-sections").textContent ?? "";
    expect(sections).toContain("Reading and Writing");
    expect(sections).toContain("54 questions");
    expect(sections).toContain("Math");
    expect(sections).toContain("Desmos calculator available.");
  });

  it("lists syllabus topics with their published weighting", () => {
    renderPage();
    const topics = screen.getByTestId("card-exam-topics").textContent ?? "";
    expect(topics).toContain("Craft and Structure");
    expect(topics).toContain("28%");
    expect(topics).toContain("Words in context");
  });

  it("links to the official exam site so students can verify the facts", () => {
    renderPage();
    const link = screen.getByTestId("link-official-site") as HTMLAnchorElement;
    expect(link.href).toContain("collegeboard.org");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
  });
});

describe("Exam detail — premium AI briefing", () => {
  it("offers generation and calls the endpoint with the exam id", () => {
    renderPage();
    clickTestId("button-generate-deep-dive");
    expect(deepDiveMutate).toHaveBeenCalledTimes(1);
    expect(deepDiveMutate.mock.calls[0][0]).toMatchObject({ data: { examId: "sat" } });
  });

  it("hides the generate button from free users and shows the upgrade gate", () => {
    premiumState = { isPremium: false, isLoadingPremium: false };
    renderPage();

    expect(screen.queryByTestId("button-generate-deep-dive")).toBeNull();
    const card = screen.getByTestId("card-deep-dive").textContent ?? "";
    expect(card).toMatch(/premium feature/i);
    expect(card).toMatch(/upgrade to premium/i);
  });

  it("never calls the AI endpoint for a free user", () => {
    premiumState = { isPremium: false, isLoadingPremium: false };
    renderPage();
    expect(deepDiveMutate).not.toHaveBeenCalled();
  });

  it("does not flash the gate while premium status is still loading", () => {
    premiumState = { isPremium: false, isLoadingPremium: true };
    renderPage();
    const card = screen.getByTestId("card-deep-dive").textContent ?? "";
    expect(card).not.toMatch(/premium feature/i);
  });

  it("still handles a 403 from the server as an upgrade prompt", () => {
    // Defence in depth: if premium lapses between page load and the click,
    // the server's 403 must surface as an upsell rather than an error toast.
    deepDiveMutate.mockImplementation((_vars, opts) => {
      opts.onError({ status: 403, data: { error: "Premium subscription required" } });
    });
    renderPage();
    clickTestId("button-generate-deep-dive");

    const panel = screen.getByTestId("panel-deep-dive-locked");
    expect(panel.textContent).toContain("Premium");
    clickTestId("button-upgrade-premium");
    expect(setLocationMock).toHaveBeenCalledWith("/premium");
  });

  it("renders a generated briefing", () => {
    deepDiveMutate.mockImplementation((_vars, opts) => {
      opts.onSuccess({
        examId: "sat",
        examName: "SAT",
        summary: "The SAT measures reasoning.",
        sections: [{ heading: "Study plan", body: "Work backwards from the test date." }],
        highYieldTopics: ["Linear equations"],
        commonMistakes: ["Leaving answers blank"],
        sources: ["https://satsuite.collegeboard.org/sat"],
      });
    });
    renderPage();
    clickTestId("button-generate-deep-dive");

    const result = screen.getByTestId("panel-deep-dive-result").textContent ?? "";
    expect(result).toContain("The SAT measures reasoning.");
    expect(result).toContain("Study plan");
    expect(result).toContain("Linear equations");
    expect(result).toContain("Leaving answers blank");
  });
});

describe("Exam detail — states and navigation", () => {
  it("shows a not-found state for an unknown exam", () => {
    examQuery = { data: undefined, isLoading: false, isError: true };
    renderPage();
    expect(screen.getByText("Exam not found")).toBeDefined();
  });

  it("sends the student to a subject-filtered quiz", () => {
    renderPage();
    clickTestId("button-practice-quiz");
    expect(setLocationMock).toHaveBeenCalledWith("/quizzes?subject=SAT");
  });

  it("can navigate back to the exam list", () => {
    renderPage();
    clickTestId("button-back");
    expect(setLocationMock).toHaveBeenCalledWith("/exam-prep");
  });
});
