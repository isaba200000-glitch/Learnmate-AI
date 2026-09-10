---
name: Clerk Bearer token in custom fetch helpers
description: Pages with their own fetch helpers must attach the Clerk Bearer token explicitly; cookies alone cause 401 from Clerk Express middleware.
---

## The Rule
Any page or component that uses a **custom `fetch` wrapper** (instead of the generated `@workspace/api-client-react` hooks) **must** attach `Authorization: Bearer <token>` to every API call. Sending only `credentials: "include"` (cookies) is not enough — Clerk Express's `getAuth(req)` returns `null` without the token, causing silent 401s.

**Why:** The Clerk Express middleware (`clerkMiddleware` in `app.ts`) validates the session via the JWT in the `Authorization` header, not via cookies. The shared API client handles this automatically via `setAuthTokenGetter` (called in `App.tsx`), but any bespoke `fetch` wrapper bypasses it.

## How to Apply
In any custom fetch helper, call `getAuthToken()` from `@workspace/api-client-react` before the request:

```ts
import { getAuthToken } from "@workspace/api-client-react";

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${import.meta.env.BASE_URL}api${url}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  });
  ...
}
```

`getAuthToken()` is a thin wrapper around `_authTokenGetter` that was added to `lib/api-client-react/src/custom-fetch.ts` and exported from `src/index.ts`. It returns `null` safely if no getter is registered (e.g. during SSR or unauthenticated renders).

## Symptom Pattern
- Profile / dashboard / other generated-client routes return **200**
- A page with a bespoke fetch helper returns **401** (responseTime ~4ms — fails before any DB query)
- The `requireAuth` middleware logs no userId
