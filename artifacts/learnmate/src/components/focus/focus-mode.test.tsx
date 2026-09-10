/**
 * Focus Mode 3-strike rule — automated UI verification (Task: confirm the
 * strike system fails a session on phones too).
 *
 * Phone path: `(pointer: coarse)` matches, so a `visibilitychange -> hidden`
 * only counts as a distraction when a touch/pointer interaction happened
 * within the previous 3s (app switch). Hidden with no recent interaction is
 * "screen off" and must NOT count.
 * Desktop path: every hidden counts.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mutateMock = vi.fn();
vi.mock("@workspace/api-client-react", () => ({
  useSaveFocusSession: () => ({ mutate: mutateMock, isPending: false }),
  getGetFocusOverviewQueryKey: () => ["focus-overview"],
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { FocusModeProvider, useFocusMode, STRICT_MAX_DISTRACTIONS } from "./focus-mode";

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockMatchMedia(coarse: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query === "(pointer: coarse)" ? coarse : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

let visibility: DocumentVisibilityState = "visible";
function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

/** Simulate the page going hidden then visible again (app switch / screen off). */
function hideAndReturn() {
  act(() => {
    setVisibility("hidden");
    setVisibility("visible");
  });
}

function touchScreen() {
  act(() => {
    window.dispatchEvent(new Event("touchstart"));
  });
}

function Harness() {
  const { startFocus } = useFocusMode();
  return (
    <button data-testid="start" onClick={() => startFocus({ minutes: 5 })}>
      start
    </button>
  );
}

function renderFocus() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <FocusModeProvider>
        <Harness />
      </FocusModeProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByTestId("start"));
  // Move past any interaction recorded around session start.
  act(() => {
    vi.advanceTimersByTime(4000);
  });
}

const savedSession = {
  id: "s1",
  plannedMinutes: 5,
  focusedSeconds: 0,
  distractions: 3,
  score: 0,
  strict: true,
  failed: true,
  completedAt: new Date(0).toISOString(),
};

beforeEach(() => {
  vi.useFakeTimers();
  mutateMock.mockReset();
  mutateMock.mockImplementation((_vars, opts?: { onSuccess?: (s: unknown) => void }) => {
    opts?.onSuccess?.(savedSession);
  });
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  visibility = "visible";
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ── Phone path ───────────────────────────────────────────────────────────────

describe("Focus Mode 3-strike rule on phones (coarse pointer)", () => {
  beforeEach(() => mockMatchMedia(true));

  it("does NOT count screen-off (hidden with no recent touch)", () => {
    renderFocus();
    hideAndReturn(); // no touch beforehand -> screen off
    act(() => vi.advanceTimersByTime(2500));
    expect(screen.getByTestId("text-distraction-count").textContent).toContain("Distractions: 0");
    expect(screen.queryByTestId("banner-distraction-warning")).toBeNull();
  });

  it("does NOT count screen-off even when the browser fires blur right before hidden", () => {
    // Some phone browsers emit window blur immediately before the screen-off
    // visibilitychange. Blur must not be treated as a user interaction, or
    // screen-off would be misclassified as an app switch (false strike).
    renderFocus();
    act(() => {
      window.dispatchEvent(new Event("blur"));
      setVisibility("hidden");
    });
    act(() => vi.advanceTimersByTime(2500));
    act(() => setVisibility("visible"));
    expect(screen.getByTestId("text-distraction-count").textContent).toContain("Distractions: 0");
    expect(screen.queryByTestId("banner-distraction-warning")).toBeNull();
  });

  it("counts app switches (touch then hidden), warns, and fails after 3 strikes with a saved failed session", () => {
    renderFocus();

    // Strike 1
    touchScreen();
    hideAndReturn();
    act(() => vi.advanceTimersByTime(2500));
    let banner = screen.getByTestId("banner-distraction-warning");
    expect(banner.textContent).toContain("1");
    expect(banner.textContent).toContain(`of ${STRICT_MAX_DISTRACTIONS}`);

    // Strike 2
    touchScreen();
    hideAndReturn();
    act(() => vi.advanceTimersByTime(2500));
    banner = screen.getByTestId("banner-distraction-warning");
    expect(banner.textContent).toContain("2");

    // Strike 3 -> session fails immediately
    touchScreen();
    hideAndReturn();
    act(() => vi.advanceTimersByTime(100));

    expect(screen.getByTestId("card-focus-summary").textContent).toContain("Session failed");
    expect(screen.getByTestId("text-summary-distractions").textContent).toBe("3");
    // Saved session (mocked API response mirrors server: failed -> score 0)
    expect(screen.getByTestId("text-summary-score").textContent).toBe("0");
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock.mock.calls[0][0]).toMatchObject({
      data: { plannedMinutes: 5, distractions: 3 },
    });
  });

  it("debounces double events (visibilitychange bursts count once per 2s)", () => {
    renderFocus();
    touchScreen();
    act(() => {
      setVisibility("hidden");
      setVisibility("visible");
      setVisibility("hidden");
      setVisibility("visible");
    });
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByTestId("banner-distraction-warning").textContent).toContain("1");
  });
});

// ── Desktop path ─────────────────────────────────────────────────────────────

describe("Focus Mode 3-strike rule on desktop (fine pointer)", () => {
  beforeEach(() => mockMatchMedia(false));

  it("counts every tab switch (no touch needed) and fails after 3", () => {
    renderFocus();
    for (let i = 0; i < 3; i++) {
      hideAndReturn();
      act(() => vi.advanceTimersByTime(2500));
    }
    expect(screen.getByTestId("card-focus-summary").textContent).toContain("Session failed");
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock.mock.calls[0][0]).toMatchObject({ data: { distractions: 3 } });
  });
});
