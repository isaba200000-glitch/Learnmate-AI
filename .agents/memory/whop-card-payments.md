---
name: Whop card payments
description: How LearnMate's card checkout works and the non-obvious rules around it
---

- Card checkout is Whop hosted checkout: server creates a checkout configuration (plan from `WHOP_PLAN_ID`, one-time $5.99) and stores a user↔checkout row; premium is granted ONLY by `/premium/whop/verify`, which lists Whop payments for the user's own open checkouts server-side.
- **Why:** the redirect back (`/premium?whop=return`) is client-controlled — never grant from it.
- Grant is one DB transaction: conditional claim of the checkout row (status created→completed) + SQL-side expiry extension `GREATEST(COALESCE(expiry, NOW()), NOW()) + interval` + payments history insert. Keeps crashes and concurrent verifies from losing paid time.
- Redirect URL must come from trusted env (`REPLIT_DOMAINS`/`REPLIT_DEV_DOMAIN`), never request headers (spoofable → open redirect).
- Whop payment success = `status: "paid"` / `substatus: "succeeded"`.
- The Whop plan price is fixed on Whop ($5.99); the owner's in-app BDT price setting only affects bKash. Changing card price requires updating the Whop plan.
- UX lesson: outcome messages after a redirect-return flow should be persistent inline banners, not toasts — toasts auto-dismiss in ~5s and testers/users miss them.
