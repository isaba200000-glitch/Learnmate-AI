# Database schema management

This package uses [Drizzle ORM](https://orm.drizzle.team/) for schema management.

## Scripts

### `pnpm db:sync` (recommended)

Apply any missing tables/columns to the connected database, derived from
the TypeScript schema files in `src/schema/`. Idempotent — safe to re-run.

```bash
pnpm db:sync
```

The script:
- Connects to `DATABASE_URL` from the env
- Reads every `pgTable(...)` definition in `src/schema/*.ts`
- For each missing table → `CREATE TABLE IF NOT EXISTS`
- For each missing column → `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` with
  a safe default (empty string / 0 / `now()` / `{}` depending on type)

It does **not** drop or rename existing columns. For destructive changes
use `pnpm db:push` (which is interactive and may prompt about data loss).

### `pnpm db:push`

Runs `drizzle-kit push` against the live DB. Interactive — requires a TTY.
It computes a full diff and shows you the SQL before applying.

```bash
pnpm db:push
```

### `pnpm push-force`

Same as `db:push --force` — applies changes that require data loss
(dropping columns, etc.). **Destructive — back up first.**

## Files

- `src/schema/*.ts` — Drizzle schema definitions (source of truth)
- `drizzle.config.ts` — Drizzle Kit config (used by `push`)
- `scripts/db-sync.mjs` — non-interactive auto-migration
- `scripts/drop-duplicates.mjs` — cleanup helper if a prior buggy run left
  duplicate columns

## Recommended workflow after schema changes

1. Edit `src/schema/*.ts`
2. `pnpm db:sync` — fast, non-destructive, no prompts
3. Verify the change locally by hitting the affected endpoint
4. Commit and deploy
