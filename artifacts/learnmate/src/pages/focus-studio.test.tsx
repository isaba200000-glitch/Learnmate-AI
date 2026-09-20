/**
 * Focus Studio (pomodoro page) 3-strike rule.
 *
 * This page had the worst version of the reported "3 strikes does not work"
 * bug: it registered no `blur` listener at all and required a touch within 3s
 * of the page hiding, so on a laptop switching windows was never counted and
 * on a phone the usual system gestures (edge-swipe home, recents, notification
 * shade) produced no strike either. It now shares `@/lib/distraction-watch`
 * with the fullscreen Focus Mode overlay, so both behave identically.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mutateMock = vi.fn();
vi.mock("@workspace/api-client-react", () => ({
  useSaveFocusSession: () => ({ mutate: mutateMock, isPending: false }),
  getGetFocusOverviewQueryKey: () => ["focus-overview"],
}));

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

// The card pulls live server data; the timer panel is what we're testing.
vi.mock("@/components/focus/focus-mode-card", () => ({
  FocusModeCard: () => null,
}));

import FocusStudioPage from "./focus-studio";

/** The page uses `useQueryClient`, so a provider is required. */
function renderStudio() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <FocusStudioPage />
    </QueryClientProvider>,
  );
}

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

function hideAndReturn() {
  act(() => {
    setVisibility("hidden");
    setVisibility("visible");
  });
}

/** Press Start on the focus timer. `handleStartPause` is async, so flush. */
async function startTimer() {
  await act(async () => {
    screen.getByTestId("button-start-pause").click();
  });
  // Clear the interaction recorded by the click itself.
  act(() => {
    vi.advanceTimersByTime(11_000);
  });
}

/** Strike counter, read off the hearts row. */
function strikeCount(): number {
  return Number(screen.getByTestId("strikes-hearts").getAttribute("data-strikes"));
}

beforeEach(() => {
  vi.useFakeTimers();
  toastMock.mockReset();
  mutateMock.mockReset();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  visibility = "visible";
  // Web Audio + Notification aren't implemented in jsdom.
  (window as unknown as { AudioContext: unknown }).AudioContext = class {
    state = "running";
    destination = {};
    currentTime = 0;
    sampleRate = 44100;
    createGain() {
      return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} };
    }
    createOscillator() {
      return { frequency: { value: 0 }, type: "sine", connect() {}, disconnect() {}, start() {}, stop() {} };
    }
    resume() {
      return Promise.resolve();
    }
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Focus Studio strikes — desktop", () => {
  beforeEach(() => mockMatchMedia(false));

  it("counts a tab switch while the focus timer runs", async () => {
    renderStudio();
    await startTimer();

    expect(strikeCount()).toBe(0);
    hideAndReturn();
    act(() => vi.advanceTimersByTime(2500));

    expect(strikeCount()).toBe(1);
  });

  it("counts switching to another application (blur, page still visible)", async () => {
    // Regression: this page previously had no blur listener whatsoever.
    renderStudio();
    await startTimer();

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    act(() => vi.advanceTimersByTime(500));

    expect(strikeCount()).toBe(1);
  });

  it("fails the session on the 3rd strike and resets the timer", async () => {
    renderStudio();
    await startTimer();

    for (let i = 0; i < 3; i++) {
      hideAndReturn();
      act(() => vi.advanceTimersByTime(2500));
    }

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("Session failed") }),
    );
    // Back to a fresh, stopped 25:00 focus timer.
    expect(screen.getByTestId("text-studio-timer").textContent).toBe("25:00");
    expect(strikeCount()).toBe(3);
    // The failed session must reach the server (it applies the same >= 3 rule).
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock.mock.calls[0][0]).toMatchObject({
      data: { plannedMinutes: 25, distractions: 3, strict: true },
    });
  });

  it("does NOT count tab switches while the timer is paused", () => {
    renderStudio();
    // Never started — leaving the app is free.
    hideAndReturn();
    act(() => vi.advanceTimersByTime(2500));

    expect(strikeCount()).toBe(0);
  });
});

describe("Focus Studio strikes — phone", () => {
  beforeEach(() => mockMatchMedia(true));

  it("counts an app switch (interaction shortly before the hide)", async () => {
    renderStudio();
    await startTimer();

    act(() => {
      window.dispatchEvent(new Event("touchstart"));
    });
    hideAndReturn();
    act(() => vi.advanceTimersByTime(2500));

    expect(strikeCount()).toBe(1);
  });

  it("does NOT count a screen-off (no recent interaction)", async () => {
    renderStudio();
    await startTimer();

    hideAndReturn();
    act(() => vi.advanceTimersByTime(2500));

    expect(strikeCount()).toBe(0);
  });
});
