// Test that the dashboard query runs without error.
import pg from "pg";

const url = process.env.DATABASE_URL;
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  // Simulate the exact query the dashboard route runs first
  // SELECT id, user_id, subject, exam_type, total_questions, correct_answers, score, source, ...
  const r = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quiz_sessions'
    ORDER BY ordinal_position
  `);
  console.log("quiz_sessions columns:", r.rows.map(x => x.column_name).join(", "));

  const r2 = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position
  `);
  console.log("users columns:", r2.rows.map(x => x.column_name).join(", "));

  // Test the actual query used in dashboard (Drizzle uses SELECT *)
  const r3 = await client.query(`SELECT * FROM quiz_sessions LIMIT 1`);
  console.log("dashboard quiz query: OK");

  const r4 = await client.query(`SELECT * FROM users LIMIT 1`);
  console.log("dashboard user query: OK");

  const r5 = await client.query(`SELECT * FROM notes LIMIT 1`);
  console.log("dashboard notes query: OK");

  const r6 = await client.query(`SELECT * FROM flashcard_decks LIMIT 1`);
  console.log("dashboard flashcards query: OK");

  const r7 = await client.query(`SELECT * FROM documents LIMIT 1`);
  console.log("dashboard documents query: OK");

  const r8 = await client.query(`SELECT * FROM study_tasks LIMIT 1`);
  console.log("dashboard study_tasks query: OK");

  const r9 = await client.query(`SELECT * FROM focus_sessions LIMIT 1`);
  console.log("dashboard focus_sessions query: OK");
} catch (e) {
  console.error("FAILED:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
