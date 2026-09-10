---
name: Hosted frontend API paths
description: Routing rule for deploying the LearnMate Vite frontend separately from its Express API.
---

The generated API client owns the `/api` path prefix. A hosted frontend's API environment variable must contain only the API server origin, without a trailing `/api`.

**Why:** Adding `/api` to the shared client's base URL produces `/api/api/...` requests and blank data pages even though authentication and the API server are healthy.

**How to apply:** When the frontend and API are on different hosts, set the external origin as the base URL and let generated routes add `/api`; apply the same origin-only helper to direct `fetch` calls.