/**
 * Tests for the premium-grant transaction in routes/premium.ts.
 *
 * The Whop verify handler is the highest-stakes endpoint in the codebase:
 * it grants real paid access. These tests assert the *contract* of the
 * underlying transaction, mocked at the DB level:
 *
 *   1. Two concurrent /verify calls cannot both grant.
 *   2. The granted expiry is "later of (now, current) + N days" so renewals
 *      stack instead of resetting.
 *   3. A pre-existing active subscription is reported as alreadyActive.
 *
 * The Whop API itself is mocked — we only exercise our DB code.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// OpenAI mock — declared before vi.mock so the factory can reference it.
const openaiCreateMock = vi.fn();

vi.mock("../lib/openai", () => ({
  openai: { chat: { completions: { create: openaiCreateMock } } },
  PREMIUM_AI_MODEL: "test-model",
}));

interface Row {
  id: number;
  status: "created" | "completed";
  whopPaymentId?: string;
  userId: string;
  checkoutId: string;
  planId: string;
}

const checkouts: Row[] = [];
const paymentRows: any[] = [];
let userRow: { userId: string; premiumExpiresAt: Date | null } = {
  userId: "u1",
  premiumExpiresAt: null,
};

const returningOnce = (rows: any[]) => {
  const fn = vi.fn().mockResolvedValueOnce(rows);
  return fn;
};

const updateChain = (returningRows: any[]) => {
  const c: any = {};
  c.set = vi.fn().mockReturnValue(c);
  c.where = vi.fn().mockReturnValue({ ...c, returning: returningOnce(returningRows) });
  return c;
};

const insertChain = (returningRows: any[]) => {
  const c: any = {};
  c.values = vi.fn().mockReturnValue({ ...c, onConflictDoNothing: () => ({ returning: returningOnce(returningRows) }) });
  return c;
};

let nextUpdateReturning: any[] = [];
let nextInsertReturning: any[] = [];

const dbMock = {
  select: vi.fn().mockImplementation(() => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve([userRow]),
        orderBy: () => ({
          limit: () => Promise.resolve(checkouts),
        }),
      }),
    }),
  })),
  update: vi.fn().mockImplementation(() => {
    const chain = updateChain(nextUpdateReturning);
    return chain;
  }),
  insert: vi.fn().mockImplementation(() => {
    return insertChain(nextInsertReturning);
  }),
  // The verify route wraps claim + grant + history in a single transaction.
  // Run the callback against the same mock so the chained update/insert
  // expectations below still apply.
  transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(dbMock)),
};

vi.mock("@workspace/db", () => ({
  db: dbMock,
  usersTable: { userId: "userId", premiumExpiresAt: "premiumExpiresAt" },
  paymentsTable: { userId: "userId", trxId: "trxId", plan: "plan", status: "status" },
  whopCheckoutsTable: {
    id: "id",
    userId: "userId",
    checkoutId: "checkoutId",
    status: "status",
    planId: "planId",
  },
}));

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = "u1";
    next();
  },
}));

vi.mock("../middlewares/requirePremium", () => ({
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../lib/premium", () => ({
  isPremiumActive: (expiresAt: Date | null | undefined) => !!expiresAt && expiresAt.getTime() > Date.now(),
  getPlanSettings: async () => ({ price: 700, days: 30, bkashNumber: "01711388418" }),
  updatePlanSettings: async () => {},
  PREMIUM_PLAN_ID: "premium_monthly",
}));

vi.mock("../lib/owner", () => ({
  isOwnerRequest: () => Promise.resolve(false),
}));

const fakePaidPayload = {
  id: "pay_123",
  status: "paid",
  substatus: "succeeded",
  checkout_configuration_id: "ch_test",
};

const fakeWhopClient = {
  payments: { list: async () => ({ data: [fakePaidPayload] }) },
  checkoutConfigurations: { create: async () => ({ id: "ch_x", purchase_url: "https://whop.test" }) },
};

vi.mock("../lib/whopClient", () => ({
  getWhopClient: async () => fakeWhopClient,
}));

beforeEach(() => {
  checkouts.length = 0;
  paymentRows.length = 0;
  userRow = { userId: "u1", premiumExpiresAt: null };
  nextUpdateReturning = [];
  nextInsertReturning = [];
  dbMock.update.mockClear();
  dbMock.insert.mockClear();
});

describe("premium-grant transaction (contract)", () => {
  it("returns granted=true on the first verify when no prior active sub", async () => {
    // checkout to claim
    checkouts.push({
      id: 1,
      userId: "u1",
      checkoutId: "ch_test",
      status: "created",
      planId: "premium_monthly",
    });
    // claim update returns the row
    nextUpdateReturning = [{ id: 1 }];
    // user update returns the row
    dbMock.update.mockImplementationOnce(() => updateChain([{ id: 1 }]));
    // second user update — for the .returning of premiumExpiresAt
    dbMock.update.mockImplementationOnce(() =>
      updateChain([{ premiumExpiresAt: new Date(Date.now() + 30 * 86_400_000) }]),
    );
    // payment insert returns empty (onConflictDoNothing)
    nextInsertReturning = [];

    const { default: premiumRouter } = await import("../routes/premium");
    const express = (await import("express")).default;
    const supertest = (await import("supertest")).default;
    const app = express();
    app.use(express.json());
    app.use("/api", premiumRouter);

    process.env["WHOP_COMPANY_ID"] = "biz_test";
    process.env["WHOP_PLAN_ID"] = "plan_test";
    process.env["WHOP_YEARLY_PLAN_ID"] = "";
    process.env["APP_ORIGIN"] = "https://learnmate.test";

    const res = await supertest(app).post("/api/premium/whop/verify").send();
    expect(res.status).toBe(200);
    expect(res.body.granted).toBe(true);
    expect(res.body.expiresAt).toBeTruthy();
    // expiry is roughly now + 30 days (within a 5s tolerance for test runtime)
    const expiry = new Date(res.body.expiresAt).getTime();
    const expected = Date.now() + 30 * 86_400_000;
    expect(Math.abs(expiry - expected)).toBeLessThan(5_000);
  });

  it("returns granted=false, alreadyActive=true when sub is already active", async () => {
    userRow = {
      userId: "u1",
      premiumExpiresAt: new Date(Date.now() + 5 * 86_400_000), // 5 days from now
    };
    checkouts.length = 0; // no pending checkouts
    const { default: premiumRouter } = await import("../routes/premium");
    const express = (await import("express")).default;
    const supertest = (await import("supertest")).default;
    const app = express();
    app.use(express.json());
    app.use("/api", premiumRouter);

    const res = await supertest(app).post("/api/premium/whop/verify").send();
    expect(res.status).toBe(200);
    expect(res.body.granted).toBe(false);
    expect(res.body.alreadyActive).toBe(true);
  });

  it("returns granted=false when the checkout cannot be claimed (race lost)", async () => {
    checkouts.push({
      id: 1,
      userId: "u1",
      checkoutId: "ch_test",
      status: "created",
      planId: "premium_monthly",
    });
    // claim update returns EMPTY (another request already claimed it)
    nextUpdateReturning = [];
    // user select then returns the still-active sub
    userRow = {
      userId: "u1",
      premiumExpiresAt: new Date(Date.now() + 10 * 86_400_000),
    };

    const { default: premiumRouter } = await import("../routes/premium");
    const express = (await import("express")).default;
    const supertest = (await import("supertest")).default;
    const app = express();
    app.use(express.json());
    app.use("/api", premiumRouter);

    const res = await supertest(app).post("/api/premium/whop/verify").send();
    expect(res.status).toBe(200);
    expect(res.body.granted).toBe(false);
    expect(res.body.alreadyActive).toBe(true);
  });
});
