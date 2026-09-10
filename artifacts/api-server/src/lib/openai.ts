import OpenAI from "openai";

// Prefer the user's own provider credentials for independent hosting. Keep
// Replit's managed integration as a migration fallback so the current app
// continues working until the replacement API is verified.
const apiKey =
  process.env.OPENAI_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

// Groq API keys always start with "gsk_". If the key looks like a Groq key and
// no explicit base URL is set we automatically point at Groq's endpoint — so
// OPENAI_BASE_URL doesn't have to be configured on Render.
const isGroqKey = apiKey?.startsWith("gsk_");
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

const baseURL =
  process.env.OPENAI_BASE_URL ??
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ??
  (isGroqKey ? GROQ_BASE_URL : undefined);

if (!apiKey) {
  throw new Error(
    "AI integration is not configured. Expected OPENAI_API_KEY (or the Replit migration fallback).",
  );
}

export const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

// Pick a model that's compatible with the configured provider:
//   • Explicit OPENAI_MODEL env var always wins (set this on Render/hosting).
//   • Groq (detected via base URL or gsk_ key prefix) → llama-3.3-70b-versatile.
//     Groq does not accept OpenAI model names like gpt-4o-mini.
//   • Other custom API key (non-Groq) → gpt-4o-mini.
//   • No custom key (Replit managed integration) → Replit-only model.
const isGroqEndpoint = baseURL?.includes("groq.com") || isGroqKey;

export const PREMIUM_AI_MODEL =
  process.env.OPENAI_MODEL ??
  (isGroqEndpoint
    ? "openai/gpt-oss-120b"
    : process.env.OPENAI_API_KEY
      ? "gpt-4o-mini"
      : "gpt-5.6-terra");
