import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, usersTable, paymentsTable, whopCheckoutsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { requirePremium } from "../middlewares/requirePremium";
import { openai, PREMIUM_AI_MODEL } from "../lib/openai";
import { getPlanSettings, PREMIUM_PLAN_ID, isPremiumActive } from "../lib/premium";

// SQL-side premium extension: later of (now, current active expiry) + N days.
function sqlGreatestExpiry(days: number) {
  return sql`GREATEST(COALESCE(${usersTable.premiumExpiresAt}, NOW()), NOW()) + make_interval(days => ${days})`;
}
import { isOwnerRequest } from "../lib/owner";
import { getWhopClient } from "../lib/whopClient";

const router: IRouter = Router();

const toPayment = (p: typeof paymentsTable.$inferSelect) => ({
  id: p.id,
  trxId: p.trxId,
  senderNumber: p.senderNumber,
  amount: p.amount,
  plan: p.plan,
  status: p.status,
  reviewNote: p.reviewNote ?? null,
  reviewedAt: p.reviewedAt ? p.reviewedAt.toISOString() : null,
  createdAt: p.createdAt.toISOString(),
});


// ─── Subscription status ─────────────────────────────────────────────────────

// ─── Available plans ─────────────────────────────────────────────────────────
//
// Returns the list of payment tiers currently configured on the server. The
// frontend uses this to hide the "yearly" tier card entirely when the yearly
// Whop plan ID is not set, so users never see a button that would 503 on click.
//
// (P0-1 fix — see result.md §4)

router.get("/premium/available-plans", requireAuth, async (_req, res): Promise<void> => {
  const hasMonthly = !!process.env.WHOP_PLAN_ID;
  const hasYearly = !!process.env.WHOP_YEARLY_PLAN_ID;
  res.json({
    monthly: { available: hasMonthly },
    yearly: { available: hasYearly },
  });
});

router.get("/premium/subscription", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userId, userId))
    .limit(1);

  const plan = await getPlanSettings();

  const [latest] = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.userId, userId))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(1);

  // Most recent approved payment determines the plan tier shown to the student.
  const [latestApproved] = await db
    .select({ plan: paymentsTable.plan })
    .from(paymentsTable)
    .where(and(eq(paymentsTable.userId, userId), eq(paymentsTable.status, "approved")))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(1);

  const planTier: "monthly" | "yearly" | null =
    latestApproved?.plan === "premium_yearly"
      ? "yearly"
      : latestApproved?.plan
      ? "monthly"
      : null;

  // Owner account: lifetime premium, no payment, no expiry.
  if (await isOwnerRequest(req)) {
    res.json({
      status: "active",
      expiresAt: null,
      isOwner: true,
      planTier: null,
      plan,
      latestPayment: latest ? toPayment(latest) : null,
    });
    return;
  }

  const expiresAt = user?.premiumExpiresAt ?? null;
  const active = isPremiumActive(expiresAt);

  let status: "none" | "pending" | "active" | "rejected" | "expired" = "none";
  if (active) {
    status = "active";
  } else if (latest?.status === "pending") {
    status = "pending";
  } else if (latest?.status === "rejected") {
    status = "rejected";
  } else if (expiresAt || latest?.status === "approved") {
    status = "expired";
  }

  res.json({
    status,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    isOwner: false,
    planTier,
    plan,
    latestPayment: latest ? toPayment(latest) : null,
  });
});

// ─── Payment submission ──────────────────────────────────────────────────────

router.get("/premium/payments", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const payments = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.userId, userId))
    .orderBy(desc(paymentsTable.createdAt));
  res.json(payments.map(toPayment));
});

// Extract the violated constraint name from a Postgres unique-violation error
// (checks the error and its cause, since drivers may wrap it).
function uniqueViolation(err: unknown): string | null {
  for (const c of [err, (err as { cause?: unknown } | null)?.cause]) {
    if (c && typeof c === "object" && (c as { code?: string }).code === "23505") {
      const e = c as { constraint?: string; constraint_name?: string };
      return e.constraint ?? e.constraint_name ?? "";
    }
  }
  return null;
}

// (bKash manual payment submission was removed — students pay by card via Whop.)

// ─── Whop card checkout ──────────────────────────────────────────────────────
// Students pay by international card via Whop's hosted checkout. Premium is
// granted ONLY after the matching Whop payment is verified server-side —
// never from the redirect back to the app.

// Trusted app origin from Replit-managed env vars only — never from request
// headers, which are client-spoofable (open-redirect risk).
function appOrigin(): string {
  const origin = process.env.APP_ORIGIN?.trim();
  if (!origin) throw new Error("APP_ORIGIN is not configured");
  return origin.replace(/\/$/, "");
}

// Helper: create a Whop checkout and insert a record
async function createWhopCheckoutSession(
  req: any,
  res: any,
  userId: string,
  planId: string,
  days: number,
  label: string
): Promise<void> {
  try {
    const client = await getWhopClient();
    const checkout = await client.checkoutConfigurations.create({
      plan_id: planId,
      redirect_url: `${appOrigin()}/premium?whop=return`,
    } as never);
    const c = checkout as unknown as { id: string; purchase_url?: string };
    if (!c.id || !c.purchase_url) {
      res.status(502).json({ error: "Could not start the card payment. Please try again." });
      return;
    }
    await db.insert(whopCheckoutsTable).values({ userId, checkoutId: c.id, planId });
    res.json({ url: c.purchase_url, days, label });
  } catch (err) {
    req.log.error({ err }, "whop checkout creation failed");
    res.status(502).json({ error: "Could not start the card payment. Please try again." });
  }
}

router.post("/premium/whop/checkout", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const planId = process.env.WHOP_PLAN_ID;
  if (!planId) {
    res.status(503).json({ error: "Card payments are not configured yet. Please try again later." });
    return;
  }
  await createWhopCheckoutSession(req, res, userId, planId, 30, "monthly");
});

router.post("/premium/whop/checkout/yearly", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const planId = process.env.WHOP_YEARLY_PLAN_ID;
  if (!planId) {
    res.status(503).json({ error: "Yearly plan not yet available. Please use the monthly plan for now." });
    return;
  }
  await createWhopCheckoutSession(req, res, userId, planId, 365, "yearly");
});

router.post("/premium/whop/verify", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;

  // Open (not yet completed) checkouts created by THIS user only.
  const open = await db
    .select()
    .from(whopCheckoutsTable)
    .where(and(eq(whopCheckoutsTable.userId, userId), eq(whopCheckoutsTable.status, "created")))
    .orderBy(desc(whopCheckoutsTable.createdAt))
    .limit(10);

  if (open.length === 0) {
    res.json({ granted: false, alreadyActive: false, expiresAt: null });
    return;
  }

  try {
    const client = await getWhopClient();
    const companyId = process.env.WHOP_COMPANY_ID;
    const payments = await client.payments.list({
      company_id: companyId,
      checkout_configuration_ids: open.map((o) => o.checkoutId),
    } as never);
    const list = (payments as unknown as { data?: unknown[] }).data ?? [];

    // Find a successfully captured payment for one of this user's checkouts.
    // Whop reports receipt status "paid" with substatus "succeeded".
    const paid = (list as Array<{
      id?: string;
      status?: string;
      substatus?: string;
      checkout_configuration_id?: string;
      checkout_configuration?: { id?: string };
    }>).find((p) => p.status === "paid" || p.substatus === "succeeded");

    if (!paid?.id) {
      res.json({ granted: false, alreadyActive: false, expiresAt: null });
      return;
    }

    const checkoutId =
      paid.checkout_configuration_id ?? paid.checkout_configuration?.id ?? open[0].checkoutId;
    const row = open.find((o) => o.checkoutId === checkoutId) ?? open[0];

    const plan = await getPlanSettings();
    const paymentId = paid.id;

    // Detect yearly plan: if the checkout planId matches WHOP_YEARLY_PLAN_ID, grant 365 days
    const yearlyPlanId = process.env.WHOP_YEARLY_PLAN_ID;
    const isYearly = !!yearlyPlanId && row.planId === yearlyPlanId;
    const grantDays = isYearly ? 365 : plan.days;
    const planLabel = isYearly ? "premium_yearly" : PREMIUM_PLAN_ID;
    const priceLabel = isYearly ? 2500 : plan.price; // cents or BDT depending on context

    // Claim + grant + history in ONE transaction so a crash mid-way cannot
    // mark the checkout completed without granting premium.
    const result = await db.transaction(async (tx) => {
      // Atomically claim this checkout so a double-verify cannot grant twice.
      const [claimed] = await tx
        .update(whopCheckoutsTable)
        .set({ status: "completed", whopPaymentId: paymentId })
        .where(and(eq(whopCheckoutsTable.id, row.id), eq(whopCheckoutsTable.status, "created")))
        .returning();
      if (!claimed) return null;

      // SQL-side extension so concurrent grants stack instead of overwriting:
      // extend from the later of now or the current still-active expiry.
      const [updatedUser] = await tx
        .update(usersTable)
        .set({
          premiumExpiresAt: sqlGreatestExpiry(grantDays),
        })
        .where(eq(usersTable.userId, userId))
        .returning({ premiumExpiresAt: usersTable.premiumExpiresAt });

      // Record it in the payment history (visible on the Premium page).
      await tx
        .insert(paymentsTable)
        .values({
          userId,
          trxId: paymentId.toUpperCase(),
          senderNumber: "card",
          amount: priceLabel,
          plan: planLabel,
          status: "approved",
          reviewNote: isYearly ? "Paid by card — Yearly plan (Whop)" : "Paid by card (Whop)",
          reviewedAt: new Date(),
        })
        .onConflictDoNothing();

      return updatedUser?.premiumExpiresAt ?? null;
    });

    if (result === null) {
      // Another request already granted for this checkout.
      const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, userId)).limit(1);
      res.json({
        granted: false,
        alreadyActive: isPremiumActive(user?.premiumExpiresAt),
        expiresAt: user?.premiumExpiresAt?.toISOString() ?? null,
      });
      return;
    }

    res.json({ granted: true, alreadyActive: false, expiresAt: result.toISOString() });
  } catch (err) {
    req.log.error({ err }, "whop payment verification failed");
    res.status(502).json({ error: "Could not verify the card payment yet. Please try again in a moment." });
  }
});

// ─── Premium AI: Smart Notes Maker ───────────────────────────────────────────

router.post(
  "/premium/smart-notes",
  requireAuth,
  requirePremium,
  async (req, res): Promise<void> => {
    const { mode, topic, content, subject } = req.body ?? {};

    if (mode !== "generate" && mode !== "summarize" && mode !== "solve") {
      res.status(400).json({ error: "mode must be one of: generate, summarize, solve" });
      return;
    }
    if (mode === "generate" && (typeof topic !== "string" || !topic.trim())) {
      res.status(400).json({ error: "topic is required for generate mode" });
      return;
    }
    if (mode !== "generate" && (typeof content !== "string" || !content.trim())) {
      res.status(400).json({ error: "content is required for this mode" });
      return;
    }

    const subjectNote =
      typeof subject === "string" && subject.trim() ? ` The subject is ${subject.trim()}.` : "";

    let userPrompt: string;
    if (mode === "generate") {
      userPrompt =
        `Create clear, complete study notes on the topic: "${(topic as string).trim()}".${subjectNote}\n\n` +
        `Structure them in markdown with: a short overview, headed sections with bullet points, ` +
        `key definitions/formulas highlighted in **bold**, worked examples where useful, and a final ` +
        `"Quick Revision" summary list of the most important points to memorise.`;
    } else if (mode === "summarize") {
      userPrompt =
        `Rewrite the following notes into clean, well-organised markdown study notes.${subjectNote} ` +
        `Keep every important fact, remove repetition, add clear headings and bullet points, and end with a ` +
        `short "Quick Revision" list:\n\n${(content as string).trim()}`;
    } else {
      userPrompt =
        `Solve or answer the following question with a clear step-by-step explanation a student can learn from.${subjectNote} ` +
        `Use markdown. Show working/reasoning first, then a clearly marked **Final Answer**:\n\n${(content as string).trim()}`;
    }

    try {
      const completion = await openai.chat.completions.create({
        model: PREMIUM_AI_MODEL,
        max_completion_tokens: 5000,
        messages: [
          {
            role: "system",
            content:
              "You are LearnMate AI's Smart Notes Maker, an expert tutor who writes exceptionally clear study material for school and college students. Always respond in well-formatted markdown.\n\n" +
              "CRITICAL RULES FOR MATHS AND FORMULAS:\n" +
              "1. NEVER use complex symbols like Σ, ∫, ∂, ∇, or LaTeX code — students find these confusing.\n" +
              "2. Always explain a formula in plain words FIRST. Example: write 'Speed = Distance divided by Time' before showing 'v = d / t'.\n" +
              "3. For every formula, give a worked example with real numbers immediately after.\n" +
              "4. Use comparisons and analogies to make abstract ideas feel concrete. For example, explain resistance in a circuit like water flowing through a narrow pipe.\n" +
              "5. If a topic has complex maths, build up from simple numbers before introducing the general rule.\n" +
              "6. End every section with a plain-English one-line summary of what was just learned.",
          },
          { role: "user", content: userPrompt },
        ],
      });

      const choice = completion.choices[0];

      req.log.info(
        {
          finishReason: choice?.finish_reason,
          contentLength: choice?.message?.content?.length ?? 0,
        },
        "smart-notes AI response",
      );

      const result = choice?.message?.content?.trim();
      if (!result) {
        res.status(502).json({ error: "The AI did not return any content. Please try again." });
        return;
      }
      res.json({ result });
    } catch (err) {
      req.log.error({ err }, "smart-notes generation failed");
      res.status(502).json({ error: "AI generation failed. Please try again." });
    }
  },
);

// ─── Premium AI: Important Questions ─────────────────────────────────────────

router.post(
  "/premium/important-questions",
  requireAuth,
  requirePremium,
  async (req, res): Promise<void> => {
    const { subject, examType, count } = req.body ?? {};

    if (typeof subject !== "string" || !subject.trim()) {
      res.status(400).json({ error: "subject is required" });
      return;
    }
    const numQuestions = Math.min(15, Math.max(3, Number(count) || 8));
    const examNote =
      typeof examType === "string" && examType.trim() ? ` preparing for ${examType.trim()}` : "";

    try {
      const completion = await openai.chat.completions.create({
        model: PREMIUM_AI_MODEL,
        max_completion_tokens: 5000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an expert exam coach. You know which questions are most frequently asked and most likely to appear in exams. You respond ONLY with valid JSON.",
          },
          {
            role: "user",
            content:
              `List the ${numQuestions} most important exam questions for a student${examNote} studying "${subject.trim()}". ` +
              `Pick questions that are most likely to appear in real exams. For each question write a detailed, complete model answer ` +
              `(with steps/working where relevant) and one sentence on why this question matters. ` +
              `Respond as JSON exactly matching this shape: ` +
              `{"questions":[{"question":"...","answer":"...","explanation":"..."}]}`,
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        res.status(502).json({ error: "The AI returned an unreadable response. Please try again." });
        return;
      }

      const questions = (parsed as { questions?: unknown }).questions;
      if (!Array.isArray(questions) || questions.length === 0) {
        res.status(502).json({ error: "The AI did not return any questions. Please try again." });
        return;
      }

      const cleaned = questions
        .filter(
          (q): q is { question: string; answer: string; explanation?: string } =>
            !!q &&
            typeof (q as { question?: unknown }).question === "string" &&
            typeof (q as { answer?: unknown }).answer === "string",
        )
        .map((q) => ({
          question: q.question,
          answer: q.answer,
          explanation: typeof q.explanation === "string" ? q.explanation : "",
        }));

      if (cleaned.length === 0) {
        res.status(502).json({ error: "The AI did not return any questions. Please try again." });
        return;
      }

      res.json({ questions: cleaned });
    } catch (err) {
      req.log.error({ err }, "important-questions generation failed");
      res.status(502).json({ error: "AI generation failed. Please try again." });
    }
  },
);

export default router;
