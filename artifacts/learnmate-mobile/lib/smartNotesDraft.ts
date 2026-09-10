/**
 * Transient in-memory store for pre-filling Smart Notes from an existing note.
 * Uses a numeric draft ID (the note's ID) as the key so the screen can detect
 * when a different note opened it and reset accordingly.
 *
 * Data lives only in the JS process — it is never written to storage and is
 * cleared after being consumed. This avoids putting large note content into
 * Expo Router URL params (which have platform-dependent length limits and
 * expose content in navigation history).
 */

export interface SmartNotesDraft {
  /** The note ID this draft came from. Used by Smart Notes to detect stale state. */
  noteId: number;
  content: string;
  subject: string;
  mode: 'generate' | 'summarize' | 'solve';
}

let pending: SmartNotesDraft | null = null;

/** Called by the note detail screen before navigating to Smart Notes. */
export function setSmartNotesDraft(draft: SmartNotesDraft): void {
  pending = draft;
}

/**
 * Consumed once by Smart Notes on mount (or when noteId param changes).
 * Returns null if no draft is waiting or the draft is for a different note.
 */
export function consumeSmartNotesDraft(noteId: number): SmartNotesDraft | null {
  if (pending?.noteId === noteId) {
    const draft = pending;
    pending = null;
    return draft;
  }
  return null;
}
