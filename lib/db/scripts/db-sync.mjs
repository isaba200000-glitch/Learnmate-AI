// Auto-migration: introspect the remote DB schema and apply any missing
// tables / columns / indexes from the Drizzle schema definitions.
//
// Run with: node scripts/db-sync.mjs
import pg from "pg";

const { Pool } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

const fs = await import("node:fs/promises");
const path = await import("node:path");
const url2 = new URL(import.meta.url);
const schemaDir = path.resolve(path.dirname(url2.pathname), "..", "src", "schema");

const files = (await fs.readdir(schemaDir)).filter((f) => f.endsWith(".ts") && f !== "index.ts");

const tableDefs = {};
for (const f of files) {
  const content = await fs.readFile(path.join(schemaDir, f), "utf-8");
  const tableMatch = content.match(/pgTable\(\s*["'](\w+)["']\s*,\s*\{([\s\S]*?)\n\s*\}\s*(?:,|\))/);
  if (!tableMatch) continue;
  const tableName = tableMatch[1];
  const body = tableMatch[2];
  const colRegex = /(\w+)\s*:\s*(text|integer|bigint|smallint|serial|bigserial|real|doublePrecision|numeric|boolean|json|jsonb|timestamp|date|time|uuid|bytea|smallSerial)\s*\(([^)]*)\)\s*([^{]*?)(?:,|\n)/g;
  const cols = [];
  let m;
  while ((m = colRegex.exec(body))) {
    const [, name, type, args, modifiers] = m;
    let sqlType;
    if (type === "text") sqlType = "TEXT";
    else if (type === "uuid") sqlType = "UUID";
    else if (type === "boolean") sqlType = "BOOLEAN";
    else if (type === "real") sqlType = "REAL";
    else if (type === "doublePrecision") sqlType = "DOUBLE PRECISION";
    else if (type === "bigint") sqlType = "BIGINT";
    else if (type === "integer") sqlType = "INTEGER";
    else if (type === "smallint") sqlType = "SMALLINT";
    else if (type === "serial") sqlType = "SERIAL";
    else if (type === "bigserial") sqlType = "BIGSERIAL";
    else if (type === "numeric") sqlType = "NUMERIC";
    else if (type === "json") sqlType = "JSON";
    else if (type === "jsonb") sqlType = "JSONB";
    else if (type === "date") sqlType = "DATE";
    else if (type === "time") sqlType = "TIME";
    else if (type === "bytea") sqlType = "BYTEA";
    else if (type === "timestamp") {
      sqlType = args.includes("withTimezone") ? "TIMESTAMP WITH TIME ZONE" : "TIMESTAMP";
    } else {
      sqlType = "TEXT";
    }
    const notNull = /\.notNull\(\)/.test(modifiers);
    const primary = /\.primaryKey\(\)/.test(modifiers);
    const unique = /\.unique\(\)/.test(modifiers);
    const isArray = /\.array\(\)/.test(modifiers);
    const isDefaultNow = /\.defaultNow\(\)/.test(modifiers);
    let defaultExpr = null;
    if (isDefaultNow) {
      defaultExpr = "now()";
    } else {
      const dm = content.match(new RegExp(`${name}\\s*:[^,]*\\.default\\(([^()]+)\\)`));
      if (dm) {
        const expr = dm[1].trim();
        if (expr && /^[A-Za-z0-9_().,'"\s-]+$/.test(expr)) defaultExpr = expr;
      }
    }
    cols.push({ name, type: sqlType, notNull, primary, unique, isArray, defaultExpr });
  }
  // The regex above matched the JS field name as `name`, but we need the DB
  // column name (the string inside `text("...")` etc.). Re-extract properly.
  const colRegexDb = /(?:^|\n)\s*(\w+)\s*:\s*(?:text|integer|bigint|smallint|serial|bigserial|real|doublePrecision|numeric|boolean|json|jsonb|timestamp|date|time|uuid|bytea|smallSerial)\s*\(\s*["']([^"']+)["']/g;
  for (let i = 0; i < cols.length; i++) {
    const m = colRegexDb.exec(body);
    if (m && m[1] === cols[i].name) cols[i].name = m[2];
  }
  tableDefs[tableName] = cols;
}

console.log(`Parsed ${Object.keys(tableDefs).length} tables from schema files`);

const client = await pool.connect();

let alterCount = 0;
let createCount = 0;

try {
  const existingTables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
  );
  const existingTableNames = new Set(existingTables.rows.map((r) => r.table_name));

  for (const [tableName, cols] of Object.entries(tableDefs)) {
    if (!existingTableNames.has(tableName)) {
      const colDefs = cols
        .map((c) => {
          let d = `"${c.name}" ${c.type}${c.isArray ? "[]" : ""}`;
          if (c.notNull && !c.primary) d += " NOT NULL";
          if (c.primary) d += " PRIMARY KEY";
          if (c.unique && !c.primary) d += " UNIQUE";
          return d;
        })
        .join(", ");
      try {
        await client.query(`CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs})`);
        console.log(`  + created table: ${tableName}`);
        createCount++;
      } catch (e) {
        console.error(`  - failed to create table ${tableName}:`, e.message);
      }
      continue;
    }

    const existingCols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
      [tableName]
    );
    const existingColNames = new Set(existingCols.rows.map((r) => r.column_name));

    for (const col of cols) {
      if (!existingColNames.has(col.name)) {
        let sql = `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}${col.isArray ? "[]" : ""}`;
      if (col.notNull && !col.primary) {
        if (col.defaultExpr) {
          sql += ` NOT NULL DEFAULT ${col.defaultExpr}`;
        } else {
          // For NOT NULL columns without a default, add as nullable first to
          // avoid Postgres rejecting empty defaults for non-string types.
          sql += " DEFAULT ''";
          if (col.type === "INTEGER" || col.type === "BIGINT" || col.type === "SMALLINT") sql = sql.replace("DEFAULT ''", "DEFAULT 0");
          if (col.type === "REAL" || col.type === "DOUBLE PRECISION" || col.type === "NUMERIC") sql = sql.replace("DEFAULT ''", "DEFAULT 0");
          if (col.type === "BOOLEAN") sql = sql.replace("DEFAULT ''", "DEFAULT false");
          if (col.type === "JSON" || col.type === "JSONB") sql = sql.replace("DEFAULT ''", "DEFAULT '{}'");
          if (col.type.includes("TIMESTAMP") || col.type === "DATE" || col.type === "TIME") sql = sql.replace("DEFAULT ''", "DEFAULT '1970-01-01'");
          if (col.type === "TEXT" && col.isArray) sql = sql.replace("DEFAULT ''", "DEFAULT '{}'");
        }
      } else if (col.defaultExpr) {
        sql += ` DEFAULT ${col.defaultExpr}`;
      }
        try {
          await client.query(sql);
          console.log(`  + added column: ${tableName}.${col.name}`);
          alterCount++;
        } catch (e) {
          console.error(`  - failed to add column ${tableName}.${col.name}:`, e.message);
        }
      }
    }
  }

  console.log(`\nDone. Created ${createCount} tables, added ${alterCount} columns.`);
} catch (e) {
  console.error("Migration failed:", e);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
