# LearnMate migration checklist

This checklist helps move LearnMate away from Replit without putting private
data or secrets into GitHub.

## Backups

- Source code: `https://github.com/isaba200000-glitch/Learnmate`
- Database export: `learnmate-database-backup.zip`
- SQL file inside the archive: `learnmate-database.sql`
- Keep the database export in at least two private locations.
- Do not commit the `exports/` directory or upload the SQL file to GitHub.

## New hosting setup

1. Clone the repository.
2. Install Node.js and pnpm.
3. Run `pnpm install`.
4. Create a PostgreSQL database.
5. Restore the SQL export into the new database:

   ```bash
   psql "YOUR_NEW_DATABASE_URL" < learnmate-database.sql
   ```

6. Add the environment variables listed below in the new host's secret
   manager, not in source files.
7. Start the API server and web app using the commands in `replit.md`.
8. Set the mobile app's production API URL before creating a new mobile build.

## Secret and configuration names

These names are used by the code. Copy the values only through a secure
password manager or the destination host's secrets tool:

- `ADMIN_PASSWORD`
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `OPENAI_API_KEY`
- `PEXELS_API_KEY`
- `SESSION_SECRET`
- `VAPID_PRIVATE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_SUBJECT`
- `WHOP_COMPANY_ID`
- `WHOP_PLAN_ID`
- `WHOP_YEARLY_PLAN_ID`
- `OWNER_EMAIL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_PROXY_URL`
- `VITE_VAPID_PUBLIC_KEY`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_URL`

`DATABASE_URL`, `PORT`, and host-provided domain variables are supplied by the
new hosting/database provider. Do not copy Replit-managed values blindly.

## Accounts to verify

- Clerk authentication
- OpenAI or the chosen AI provider
- Pexels
- Whop
- Expo/EAS
- Apple Developer Program
- Google Play Console
- Domain registrar and DNS provider

## Before canceling Replit

- Open the GitHub repository and confirm the latest code is present.
- Extract the database ZIP and confirm `learnmate-database.sql` exists.
- Restore the SQL file into a separate test PostgreSQL database.
- Run the web app and API outside Replit.
- Test login, notes, AI features, images, Premium payments, and notifications.
- Do not delete the Replit project until the independent copy passes those checks.