/**
 * Lightweight helper for manual API calls (SSE streaming, custom endpoints).
 * All authenticated calls use getAuthToken() so the Bearer token flows
 * through the same getter registered via setAuthTokenGetter().
 *
 * Production API origin:
 *   - Dev (Expo Go / Metro web): EXPO_PUBLIC_DOMAIN injected by the dev script
 *   - EAS / store builds: set EXPO_PUBLIC_API_URL to the full origin, e.g.
 *     "https://yourapp.replit.app" in your eas.json or EAS environment variables.
 */
import { fetch as expoFetch } from 'expo/fetch';
import { getAuthToken } from '@workspace/api-client-react';

export function getApiBase(): string {
  // Prefer an explicit full origin (used in EAS/production builds)
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  // Fallback: dev domain injected by Metro dev script
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  // Production fallback: Render API server
  return 'https://learnmate-ej59.onrender.com';
}

export async function apiFetch<T = unknown>(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!headers['Content-Type'] && options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await expoFetch(`${getApiBase()}${path}`, {
    method: options.method,
    headers,
    body: options.body,
    signal: options.signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Streams an SSE endpoint, calling onChunk for every `content` token received.
 * Returns when the stream is complete.
 */
export async function streamSse(
  path: string,
  body: unknown,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await expoFetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    if (response.status === 429) {
      const body = await response.json().catch(() => ({})) as { error?: string; limitReached?: boolean };
      const err = new Error(body.error ?? 'Daily message limit reached') as Error & { limitReached: boolean; status: number };
      err.limitReached = true;
      err.status = 429;
      throw err;
    }
    throw new Error(`Stream error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data) as { content?: string; token?: string; delta?: { content?: string } };
        const text = parsed.content ?? parsed.token ?? parsed.delta?.content ?? '';
        if (text) onChunk(text);
      } catch {
        // skip malformed chunk
      }
    }
  }
}
