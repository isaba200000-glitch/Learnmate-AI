---
name: Testing-subagent env overrides
description: Workflow env overrides in e2e test runs can silently fail — verify before trusting a red result
---

## Rule
When a test plan depends on a workflow env-var override (e.g. pointing a feature at a test email/password), treat the override as unverified until proven applied.

**Why:** A tester once restarted the API server "with an env override", the variable never reached the process (`/proc/<pid>/environ` showed it absent), and the run reported the feature as broken when the feature was never exercised.

**How to apply:**
- Have the server print a startup breadcrumb for any env-configurable behavior (e.g. `[owner] owner access bound to: …`) and make the tester assert on that log line before running the flow.
- When a test that depends on an override fails, check `/proc/<server pid>/environ` yourself before touching the code.
- Instruct testers: if the override won't land after 2 tries, report "unable", not "failure".
