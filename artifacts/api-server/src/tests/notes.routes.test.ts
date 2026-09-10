/**
 * Route-order and error-handling tests for the notes API.
 *
 * These tests guard two historically broken behaviours:
 *
 *  1. GET /notes/image?subject=... was swallowed by /notes/:id when route
 *     order was wrong. We assert the image handler is reachable and returns
 *     { imageUrl } or a clean API error – never a 404 from the id handler.
 *
 *  2. GET /notes/<non-numeric-id> must return 404 without crashing the process
 *     (parseInt('garbage') returns NaN which then becomes a DB query with NaN id).
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import express from "express";
import request from "supertest";

// ── Mocks (must be declared before the module under test is imported) ─────────

// Mock @workspace/db so no real Postgres connection is needed
vi.mock("@workspace/db", () => {
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]), // no cached image → triggers fetch path
      }),
      orderBy: vi.fn().mockResolvedValue([]),
    }),
  });

  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
      returning: vi.fn().mockResolvedValue([]),
    }),
  });

  return {
    db: { select: mockSelect, insert: mockInsert, update: vi.fn(), delete: vi.fn() },
    notesTable: { id: "id", userId: "userId", subject: "subject", title: "title", content: "content", tags: "tags", createdAt: "createdAt", updatedAt: "updatedAt", $inferSelect: {} },
    noteSubjectImagesTable: { subjectKey: "subjectKey", imageUrl: "imageUrl", photographerName: "photographerName", photographerUrl: "photographerUrl" },
  };
});

// Mock auth middleware: just stamps a userId and calls next()
vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = "test-user-id";
    next();
  },
}));

// Mock Pexels photo helper so tests don't call external APIs
vi.mock("../lib/realPhotos", () => ({
  getNotePhoto: vi.fn().mockResolvedValue({
    url: "https://example.com/photo.jpg",
    photographerName: "Test Photographer",
    photographerUrl: "https://www.pexels.com/@test",
  }),
}));

// ── Test app setup ────────────────────────────────────────────────────────────

let app: express.Express;

beforeAll(async () => {
  // Import the notes router AFTER mocks are installed
  const { default: notesRouter } = await import("../routes/notes");
  app = express();
  app.use(express.json());
  app.use("/api", notesRouter);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/notes/image — route ordering", () => {
  it("reaches the image handler and returns imageUrl when cache is cold", async () => {
    const res = await request(app)
      .get("/api/notes/image")
      .query({ subject: "biology" });

    // Must not be a 404 from the :id handler treating 'image' as a non-existent id
    expect(res.status).not.toBe(404);
    // Should be 200 with an imageUrl, or a clean 5xx if external calls failed
    if (res.status === 200) {
      expect(res.body).toHaveProperty("imageUrl");
      expect(typeof res.body.imageUrl).toBe("string");
    } else {
      // 502 is acceptable (Pexels unavailable); 4xx from the id handler is not
      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(res.body).toHaveProperty("error");
    }
  });

  it("returns 400 when subject query param is missing", async () => {
    const res = await request(app).get("/api/notes/image");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns imageUrl from cache when image is already stored", async () => {
    // Override the DB mock to simulate a cache hit
    const { db } = await import("@workspace/db");
    const cached = {
      imageUrl: "https://cached.example.com/photo.jpg",
      photographerName: "Cached Photographer",
      photographerUrl: "https://www.pexels.com/@cached",
    };
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([cached]),
        }),
      }),
    } as any);

    const res = await request(app)
      .get("/api/notes/image")
      .query({ subject: "chemistry" });

    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toBe("https://cached.example.com/photo.jpg");
  });
});

describe("GET /api/notes/:id — non-numeric id guard", () => {
  it("returns 404 for a non-numeric id without crashing", async () => {
    // DB mock returns [] (no note found) — same as 'not found'
    const res = await request(app).get("/api/notes/garbage-id");
    // Must return 404, not 500 (crash) or hit the image handler
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 404 for a negative numeric id without crashing", async () => {
    const res = await request(app).get("/api/notes/-1");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });
});
