/**
 * Shared quota constants. Keep these in sync between the AI Assistant
 * (routes/assistant.ts) and the legacy OpenAI Chat (routes/openai-chat.ts)
 * — the two endpoints intentionally share a single daily counter via
 * assistant_usage.questionsUsed so a free user can never burn more than
 * this many AI messages per day across both surfaces.
 *
 * The constant lives in its own file (rather than in `lib/premium.ts`) so
 * it can be safely imported by `routes/openai-chat.ts` without pulling in
 * any unrelated premium dependencies.
 */

/** Free daily AI message limit (Assistant + Chat combined), Dhaka-day. */
export const FREE_DAILY_AI_MESSAGES = 10;

/** Message shown to free users when they've hit the cap. */
export const AI_MESSAGE_LIMIT_MESSAGE =
  "You've used all 10 free AI messages for today. Upgrade to Premium for unlimited chat, or come back tomorrow.";
