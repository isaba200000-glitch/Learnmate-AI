import app from "./app";
import { logger } from "./lib/logger";
import { pruneOldConversations } from "./routes/assistant";
import { pruneOldAnswers } from "./routes/language";
import { prewarmTopicImages, prewarmLessonImages, prewarmLessonStepImages } from "./routes/courses";
const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function runPrune() {
  try {
    const removed = await pruneOldConversations();
    if (removed > 0) {
      logger.info({ removed }, "Pruned old AI conversations");
    }
  } catch (err) {
    logger.error({ err }, "Failed to prune old AI conversations");
  }
  try {
    const removed = await pruneOldAnswers();
    if (removed > 0) {
      logger.info({ removed }, "Pruned old language-practice answers");
    }
  } catch (err) {
    logger.error({ err }, "Failed to prune old language-practice answers");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // ── Prune: run once at startup then every 24 h ──────────────────────────
  // Best-effort fallback for long-running hosts. On hosts that suspend after
  // a short idle window (Replit autoscale, Render free tier) this interval
  // can miss days — the same jobs are exposed as admin-token-guarded HTTP
  // endpoints at POST /api/admin/jobs/prune-old-data so an external
  // scheduler (Replit Scheduled Deployment, GitHub Actions, Upstash
  // QStash, etc.) can run them once per day.
  // Exam reminders are intentionally NOT scheduled here — autoscale deployments
  // can be suspended, making in-process timers unreliable. Instead, call
  // POST /api/push/send-exam-reminders (with the admin token) from a durable
  // external scheduler.
  logger.info(
    "In-process prune interval is a best-effort fallback — configure an external scheduler to POST /api/admin/jobs/prune-old-data daily for reliability.",
  );
  runPrune();
  setInterval(runPrune, DAILY_INTERVAL_MS);

  // ── Pre-warm topic hero images, free lesson illustrations, then step images ─
  // Run sequentially to avoid concurrent image-API rate-limit pressure.
  // Each function returns a counts object; we log a final summary so the
  // owner can see at a glance whether the cache is fully populated.
  // (Re-entrant: also re-fetches rows with imageUrl IS NULL or empty, so a
  // partial Pexels outage on a previous boot self-heals on the next start.)
  (async () => {
    const start = Date.now();
    try {
      const topics = await prewarmTopicImages();
      const lessons = await prewarmLessonImages();
      const steps = await prewarmLessonStepImages();
      logger.info(
        {
          elapsedMs: Date.now() - start,
          topics,
          lessons,
          steps,
        },
        "Pre-warm complete",
      );
    } catch (err) {
      logger.error({ err }, "Pre-warm sequence failed");
    }
  })();
});
