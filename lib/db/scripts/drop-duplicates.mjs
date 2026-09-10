// Drop the duplicate columns that were created with the wrong (JS field) names
// by the first buggy run of db-sync. These exist in addition to the correct
// snake_case columns.
import pg from "pg";

const { Pool } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const client = await pool.connect();

// These column names are duplicates (camelCase versions) added by the first
// buggy run of db-sync. They should be removed so the DB only has the
// canonical snake_case columns that the Drizzle code expects.
const duplicates = [
  ["quiz_sessions", ["userId", "examType", "correctAnswers", "imageUrl", "createdAt", "completedAt", "totalQuestions"]],
  ["users", ["userId", "photoUrl", "educationLevel", "learningLanguage", "premiumExpiresAt", "lastActiveAt", "createdAt", "updatedAt"]],
  ["conversations", ["userId", "createdAt", "updatedAt"]],
  ["course_lesson_cache", ["userId", "courseSlug", "lessonSlug", "language", "lessonIndex", "imageUrl", "generatedAt"]],
  ["documents", ["userId", "createdAt"]],
  ["exam_events", ["userId", "createdAt", "updatedAt"]],
  ["exam_plans", ["userId", "dayCount", "completedDayCount", "createdAt"]],
  ["flashcard_decks", ["userId", "cardCount", "createdAt", "updatedAt"]],
  ["focus_sessions", ["userId", "completedAt"]],
  ["language_usage", ["userId", "secondsUsed", "lastTickAt", "createdAt"]],
  ["messages", ["conversationId", "createdAt"]],
  ["notes", ["userId", "createdAt", "updatedAt"]],
  ["payments", ["userId", "trxId", "senderNumber", "reviewNote", "reviewedAt", "createdAt", "updatedAt"]],
  ["push_reminder_logs", ["userId", "sentAt"]],
  ["push_subscriptions", ["userId", "createdAt"]],
  ["settings", []],
  ["study_plans", ["userId", "examDate", "studyHoursPerDay", "taskCount", "completedTaskCount", "createdAt"]],
  ["study_tasks", []],
  ["whop_checkouts", ["userId", "checkoutId", "planId", "whopPaymentId", "createdAt"]],
  ["achievements", ["userId"]],
];

let dropCount = 0;
let failCount = 0;

for (const [table, cols] of duplicates) {
  for (const col of cols) {
    try {
      await client.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${col}"`);
      console.log(`  - dropped ${table}.${col}`);
      dropCount++;
    } catch (e) {
      console.error(`  ! failed to drop ${table}.${col}:`, e.message);
      failCount++;
    }
  }
}

console.log(`\nDone. Dropped ${dropCount} duplicate columns. ${failCount} failures.`);
client.release();
await pool.end();
