---
name: Groq as free OpenAI replacement
description: LearnMate migrated from Replit-managed OpenAI to Groq free tier on Render; image generation is unavailable.
---

# Groq as free AI provider on Render

## Rule
Set these three env vars on Render to use Groq instead of OpenAI:
- `OPENAI_BASE_URL` = `https://api.groq.com/openai/v1`
- `OPENAI_API_KEY` = Groq key (starts with `gsk_`)
- `OPENAI_MODEL` = `llama-3.3-70b-versatile`

The OpenAI client in `artifacts/api-server/src/lib/openai.ts` already respects `OPENAI_BASE_URL` and `OPENAI_MODEL` so no code changes are needed.

**Why:** User has no budget for OpenAI. Groq is free with no credit card required. Compatible with the OpenAI JS SDK.

**How to apply:** Any future AI model change just updates `OPENAI_MODEL` in Render env vars.

## Limitation
Groq does not support image generation. The `/assistant/visualize` endpoint (`artifacts/api-server/src/routes/assistant.ts`) still calls `openai.images.generate` which will return a 502 error when using Groq. The frontend shows a toast error. `OPENAI_IMAGE_MODEL` env var on Render still points to `gpt-image-1` but it is non-functional.
