import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  courseLessonCacheTable,
  courseProgressTable,
  courseUsageTable,
  courseTopicImagesTable,
  courseLessonImagesTable,
  courseLessonStepImagesTable,
} from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { openai, PREMIUM_AI_MODEL } from "../lib/openai";
import { isPremiumActive } from "../lib/premium";
import { isOwnerRequest } from "../lib/owner";
import { dhakaDay } from "../lib/language";
import {
  getTopicPhoto,
  getLessonPhoto,
  getStepPhotos,
  type PhotoResult,
} from "../lib/realPhotos";

const router: IRouter = Router();

// ─── Course curriculum definition ────────────────────────────────────────────

export interface Lesson {
  title: string;
  summary: string;
  isPremium: boolean; // true = requires premium
}

export interface CourseTopic {
  slug: string;
  title: string;
  emoji: string;
  description: string;
  color: string; // tailwind bg colour token
  lessons: Lesson[];
}

export const COURSE_TOPICS: CourseTopic[] = [
  {
    slug: "robotics",
    title: "Robotics",
    emoji: "🤖",
    description: "Learn how robots work, how they are built, and how to program them — from scratch.",
    color: "sky",
    lessons: [
      { title: "What is a Robot?", summary: "Discover what makes a machine a robot and see real-world examples.", isPremium: false },
      { title: "Robot Parts: Sensors, Motors & Controllers", summary: "Understand the three key building blocks of every robot.", isPremium: false },
      { title: "How Robots Sense the World", summary: "Explore touch, light, distance and colour sensors.", isPremium: false },
      { title: "How Robots Move", summary: "Learn about wheels, legs, servo motors and actuators.", isPremium: false },
      { title: "Introduction to Arduino", summary: "Your first look at the most popular beginner robotics board.", isPremium: true },
      { title: "Writing Simple Robot Commands", summary: "Control an LED and a motor with basic code.", isPremium: true },
      { title: "Build a Line-Following Robot (Plan)", summary: "Design your own line-following robot step by step.", isPremium: true },
      { title: "Programming Robot Behaviors", summary: "Learn how to code sequences and reactions that make a robot behave intelligently.", isPremium: true },
      { title: "Building a Remote-Controlled Robot", summary: "Discover how wireless signals are used to control a robot from a distance.", isPremium: true },
      { title: "Robot Safety and Ethics", summary: "Understand the rules and responsibilities that come with building and using robots.", isPremium: true },
      { title: "Autonomous Navigation Basics", summary: "Explore how robots find their way around without human guidance.", isPremium: true },
      { title: "Computer Vision for Robots", summary: "See how cameras and software let robots identify and respond to objects.", isPremium: true },
      { title: "Real-World Robotics Projects", summary: "Study inspiring projects where robots are solving real problems today.", isPremium: true },
      { title: "The Future of Robotics", summary: "Look ahead at emerging trends and career opportunities in the world of robotics.", isPremium: true },
    ],
  },
  {
    slug: "electronics",
    title: "Electronics",
    emoji: "⚡",
    description: "Understand electricity, circuits and components — the foundation of all tech.",
    color: "amber",
    lessons: [
      { title: "What is Electricity?", summary: "Electrons, charge and the basics of electric flow, explained simply.", isPremium: false },
      { title: "Voltage, Current & Resistance", summary: "The three most important quantities — with everyday analogies.", isPremium: false },
      { title: "Reading a Circuit Diagram", summary: "Learn the symbols and follow a circuit like a map.", isPremium: false },
      { title: "Resistors, Capacitors & LEDs", summary: "Meet the most common components and learn what each does.", isPremium: false },
      { title: "How a Breadboard Works", summary: "The reusable board that lets you build circuits without soldering.", isPremium: true },
      { title: "Building Your First Circuit", summary: "Wire up a working LED circuit step by step.", isPremium: true },
      { title: "Introduction to Transistors", summary: "The tiny switch inside every chip — what it is and how it works.", isPremium: true },
      { title: "Diodes and Rectifiers", summary: "Learn how diodes control current direction and how rectifiers convert AC to DC.", isPremium: true },
      { title: "Basic Amplifier Circuits", summary: "Discover how small signals are boosted to useful power levels in amplifier circuits.", isPremium: true },
      { title: "Power Supplies Explained", summary: "Understand how devices convert mains electricity into safe, usable voltages.", isPremium: true },
      { title: "Introduction to ICs", summary: "Explore how integrated circuits pack thousands of components onto a tiny chip.", isPremium: true },
      { title: "Digital vs Analogue Circuits", summary: "Compare the two main types of electronic signals and where each is used.", isPremium: true },
      { title: "PCB Design Basics", summary: "Get a first look at how printed circuit boards are designed and manufactured.", isPremium: true },
      { title: "Electronics in Everyday Products", summary: "Trace the electronic components hidden inside the gadgets you use every day.", isPremium: true },
    ],
  },
  {
    slug: "python",
    title: "Python",
    emoji: "🐍",
    description: "Learn Python — the world's most beginner-friendly programming language.",
    color: "green",
    lessons: [
      { title: "What is Python & Why Learn It?", summary: "Why Python is the best first language and what you can build with it.", isPremium: false },
      { title: "Variables & Data Types", summary: "Store text, numbers and true/false values in your program.", isPremium: false },
      { title: "Your First Program: print() & input()", summary: "Write code that talks to the user.", isPremium: false },
      { title: "If Statements & Logic", summary: "Make decisions in your program with if/else.", isPremium: false },
      { title: "Loops: for & while", summary: "Repeat actions automatically without copy-pasting code.", isPremium: true },
      { title: "Functions: Reusable Code Blocks", summary: "Organise your code into neat, reusable pieces.", isPremium: true },
      { title: "Lists & Dictionaries", summary: "Store collections of data and look them up instantly.", isPremium: true },
      { title: "Working with Files", summary: "Read from and write to files so your program can save and load data.", isPremium: true },
      { title: "Object-Oriented Programming Basics", summary: "Learn how to model real-world things as objects with properties and actions.", isPremium: true },
      { title: "Error Handling with Try/Except", summary: "Prevent your program from crashing by gracefully catching and handling errors.", isPremium: true },
      { title: "Python Standard Libraries", summary: "Discover the built-in toolbox of modules that save you from reinventing the wheel.", isPremium: true },
      { title: "Building a Calculator App", summary: "Put your Python skills together to build a fully working command-line calculator.", isPremium: true },
      { title: "Introduction to APIs", summary: "Learn how your Python code can talk to web services and fetch real data.", isPremium: true },
      { title: "Your First Data Analysis", summary: "Use Python to load, explore and visualise a simple dataset.", isPremium: true },
    ],
  },
  {
    slug: "cpp",
    title: "C++",
    emoji: "⚙️",
    description: "C++ powers games, robots and operating systems. Start from zero.",
    color: "violet",
    lessons: [
      { title: "What is C++ and Where is it Used?", summary: "Games, embedded systems, high performance — meet C++.", isPremium: false },
      { title: "Your First C++ Program", summary: "Write, compile and run Hello World in C++.", isPremium: false },
      { title: "Variables & Data Types in C++", summary: "int, float, char, bool — store different kinds of data.", isPremium: false },
      { title: "Input & Output with cin and cout", summary: "Read from the keyboard and print to the screen.", isPremium: false },
      { title: "Conditionals & Loops", summary: "if/else, for and while loops in C++.", isPremium: true },
      { title: "Functions in C++", summary: "Write clean, reusable code blocks.", isPremium: true },
      { title: "Arrays & Strings", summary: "Store and manipulate collections of data.", isPremium: true },
      { title: "Pointers and References", summary: "Understand how C++ uses memory addresses to work with data directly and efficiently.", isPremium: true },
      { title: "OOP in C++", summary: "Discover why object-oriented programming makes large C++ projects manageable.", isPremium: true },
      { title: "Classes and Objects", summary: "Define your own data types by writing classes with data members and methods.", isPremium: true },
      { title: "Inheritance Explained", summary: "Learn how one class can extend another to reuse and specialise behaviour.", isPremium: true },
      { title: "File Input and Output", summary: "Write C++ programs that read from and save data to files on disk.", isPremium: true },
      { title: "Standard Template Library", summary: "Explore the powerful collection of ready-made data structures and algorithms in the STL.", isPremium: true },
      { title: "Building a Simple Game in C++", summary: "Apply everything you have learned to create a small text-based game in C++.", isPremium: true },
    ],
  },
  {
    slug: "ai-ml",
    title: "AI & Machine Learning",
    emoji: "🧠",
    description: "Understand how AI really works — no maths degree needed.",
    color: "rose",
    lessons: [
      { title: "What is Artificial Intelligence?", summary: "What AI is, what it is not, and where it already lives in your life.", isPremium: false },
      { title: "How Do Machines Learn?", summary: "Training data, patterns and predictions — the core idea of ML.", isPremium: false },
      { title: "Rules vs Learning: Two Types of AI", summary: "Old-school rule-based AI vs modern machine learning.", isPremium: false },
      { title: "How ChatGPT Works (Plain Explanation)", summary: "Tokens, prediction and large language models — explained simply.", isPremium: false },
      { title: "What is a Neural Network?", summary: "The brain-inspired structure behind modern AI.", isPremium: true },
      { title: "AI in Everyday Life", summary: "Recommendations, translation, face detection — AI all around you.", isPremium: true },
      { title: "Using AI Tools as a Student", summary: "How to use AI responsibly to learn faster and smarter.", isPremium: true },
      { title: "Training Your First Model", summary: "Walk through the steps of feeding data to an algorithm and watching it learn.", isPremium: true },
      { title: "Understanding Datasets", summary: "Learn what makes a good dataset and why data quality matters so much in AI.", isPremium: true },
      { title: "Bias and Fairness in AI", summary: "Explore why AI systems can be unfair and how engineers work to reduce bias.", isPremium: true },
      { title: "Computer Vision Basics", summary: "Discover how AI systems analyse images and video to recognise objects and faces.", isPremium: true },
      { title: "Natural Language Processing", summary: "Learn how AI reads, understands and generates human language.", isPremium: true },
      { title: "AI Ethics", summary: "Examine the big questions about privacy, accountability and the responsible use of AI.", isPremium: true },
      { title: "Careers in AI", summary: "Find out what roles exist in the AI industry and what skills each one requires.", isPremium: true },
    ],
  },
  {
    slug: "coding-basics",
    title: "Coding Basics",
    emoji: "💻",
    description: "No language, no jargon — just the pure logic that all coding is built on.",
    color: "teal",
    lessons: [
      { title: "What is a Computer Program?", summary: "Instructions, logic and computers — the big picture.", isPremium: false },
      { title: "Variables: Storing Information", summary: "How programs remember things — the variable concept.", isPremium: false },
      { title: "Logic & Decisions", summary: "True/false thinking and how computers make choices.", isPremium: false },
      { title: "Loops: Repeating Actions", summary: "Do something 1000 times with just a few lines.", isPremium: false },
      { title: "Functions: Reusable Building Blocks", summary: "Name a chunk of logic so you can use it again and again.", isPremium: true },
      { title: "Debugging: Finding & Fixing Mistakes", summary: "Why bugs happen and a simple method to find them.", isPremium: true },
      { title: "How the Internet Works", summary: "Servers, browsers, HTTP — the basics every coder should know.", isPremium: true },
      { title: "Algorithms Step by Step", summary: "Understand what an algorithm is and how to design clear step-by-step solutions.", isPremium: true },
      { title: "Data Structures Explained", summary: "Learn how lists, stacks, queues and trees organise data for fast access.", isPremium: true },
      { title: "Version Control with Git", summary: "Track changes to your code and collaborate safely using Git.", isPremium: true },
      { title: "APIs How Apps Talk", summary: "See how applications request and share data with each other over the internet.", isPremium: true },
      { title: "Databases Where Data Lives", summary: "Discover how databases store, organise and retrieve information for apps.", isPremium: true },
      { title: "Web Basics HTML CSS JS", summary: "Get a plain-language overview of the three languages that power every website.", isPremium: true },
      { title: "Building Your First Website", summary: "Combine HTML, CSS and a touch of JavaScript to publish your own web page.", isPremium: true },
    ],
  },
];

// ─── Limits ──────────────────────────────────────────────────────────────────

const FREE_DAILY_LESSONS = 3;

async function getLessonsGeneratedToday(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: courseUsageTable.lessonsGenerated })
    .from(courseUsageTable)
    .where(and(eq(courseUsageTable.userId, userId), eq(courseUsageTable.day, dhakaDay())))
    .limit(1);
  return row?.n ?? 0;
}

async function incrementLessonUsage(userId: string): Promise<void> {
  const day = dhakaDay();
  const updated = await db
    .update(courseUsageTable)
    .set({ lessonsGenerated: sql`${courseUsageTable.lessonsGenerated} + 1` })
    .where(and(eq(courseUsageTable.userId, userId), eq(courseUsageTable.day, day)))
    .returning();
  if (updated.length === 0) {
    await db
      .insert(courseUsageTable)
      .values({ userId, day, lessonsGenerated: 1 })
      .onConflictDoNothing();
  }
}

// ─── Real photo fetchers (no AI generation) ───────────────────────────────────

async function getRealTopicImage(topic: CourseTopic): Promise<PhotoResult> {
  return getTopicPhoto(topic.slug);
}

async function getRealLessonImage(topic: CourseTopic, lessonIndex: number): Promise<PhotoResult> {
  return getLessonPhoto(topic.slug, lessonIndex);
}

// ─── AI lesson generator ──────────────────────────────────────────────────────

async function generateLessonContent(topic: CourseTopic, lesson: Lesson): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: PREMIUM_AI_MODEL,
    // The 8-section structure below (with worked examples, code blocks and
    // three model answers) does not fit in 1200 tokens — lessons were being
    // truncated mid-sentence and then cached permanently in that state.
    max_tokens: 6000,
    messages: [
      {
        role: "system",
        content:
          "You are LearnMate AI's Expert Technology Tutor — a world-class teacher combining the clarity of the best classroom instructors " +
          "with the depth of a university professor. Your students are aged 13–20 with little or no prior knowledge of technology subjects.\n\n" +
          "ACCURACY COMES FIRST. These lessons are what students learn from, so a confident wrong statement is the worst possible outcome:\n" +
          "• Every fact, figure, formula, standard and date must be correct. If you are not certain something is true, leave it out.\n" +
          "• Never invent component names, library functions, API calls, pin numbers or specifications. Use only real, documented ones.\n" +
          "• All code must be syntactically valid and actually run as written. Mentally execute it before including it.\n" +
          "• State the language/version or hardware a code sample targets when it matters (e.g. Python 3, Arduino Uno).\n" +
          "• Use correct SI units and realistic values (a typical LED forward voltage is ~2 V, not 200 V).\n" +
          "• Where experts genuinely disagree or practice varies, say so rather than presenting one view as settled fact.\n" +
          "• Prefer timeless explanations over fast-moving specifics; if you cite something current, note that it may change.\n\n" +
          "YOUR TEACHING STYLE:\n" +
          "• Begin with a compelling hook that makes the student genuinely curious.\n" +
          "• Build understanding layer by layer — start simple, then reveal the depth.\n" +
          "• Every abstract concept MUST have a concrete, vivid real-world analogy.\n" +
          "• Be explicit when an analogy breaks down — half-true mental models cause exam mistakes later.\n" +
          "• Every claim must be explained, not just stated.\n" +
          "• Use rich markdown formatting: ## headings, bullet points, numbered steps, **bold** key terms, `code` for any code snippets, and ``` blocks for multi-line code.\n" +
          "• Write in plain text and markdown only. Never output raw HTML tags or HTML entities.\n\n" +
          "RULES FOR MATHS AND FORMULAS:\n" +
          "• First explain the formula in plain words (e.g. 'Resistance = Voltage ÷ Current').\n" +
          "• Then show it in simple symbolic notation (e.g. R = V / I).\n" +
          "• Always work through a full numerical example with real numbers and units.\n" +
          "• Check the arithmetic in every worked example; the numbers must actually come out as stated.\n" +
          "• Never use LaTeX, Σ, ∫, ∂, or Greek letters without immediately defining them in plain English.\n\n" +
          "QUALITY BAR: Every lesson must be so clear, engaging and complete that a student who reads it carefully " +
          "could confidently answer exam questions on the topic without any other resource — and everything they learn must be correct.",
      },
      {
        role: "user",
        content:
          `Write a complete, high-quality lesson for: **${topic.title}** → **${lesson.title}**\n\n` +
          `Core idea: ${lesson.summary}\n\n` +
          `Use this exact structure:\n\n` +
          `## 🎯 What You'll Learn\n` +
          `(2–3 precise sentences: what the student will understand and be able to do after this lesson)\n\n` +
          `## 💡 The Big Idea\n` +
          `(Introduce the core concept with a vivid real-world analogy that clicks immediately)\n\n` +
          `## 🔍 How It Works — Step by Step\n` +
          `(Detailed breakdown with numbered steps, sub-points, and at least one worked example or diagram described in words)\n\n` +
          `## ⚙️ Key Terms Explained\n` +
          `(Define every important technical term introduced in this lesson — 3 to 6 terms, each with a one-sentence plain-English definition)\n\n` +
          `## 🌍 Real-World Applications\n` +
          `(2–3 specific, concrete examples of where this concept is used today — be specific, not generic)\n\n` +
          `## ⚠️ Common Mistakes to Avoid\n` +
          `(2–3 mistakes beginners frequently make and exactly why they are wrong)\n\n` +
          `## 💡 Key Takeaway\n` +
          `(One razor-sharp sentence that captures the single most important thing to remember)\n\n` +
          `## 🎯 Try This — Practice Questions\n` +
          `(3 questions of increasing difficulty: one recall, one application, one thinking question — include full model answers)`,
      },
    ],
  });

  const choice = completion.choices[0];
  const content = choice?.message?.content?.trim() ?? "";

  // Never cache a lesson the model ran out of room to finish: `length` means
  // the response hit the token ceiling and the student would be left reading a
  // sentence that stops mid-word, permanently.
  if (choice?.finish_reason === "length") {
    throw new Error("lesson generation truncated (hit the token limit)");
  }

  return content;
}

// ─── Startup pre-warm ────────────────────────────────────────────────────────

/**
 * Called once at server startup. Generates and caches hero illustrations for
 * any topic that doesn't already have one, so the first student to visit a
 * course card never sees a loading skeleton.
 *
 * Re-entrant: also re-fetches rows whose `imageUrl` is NULL or empty (broken
 * cache state from a partial Pexels outage on a previous boot). Generation is
 * sequential (not in parallel) to avoid hammering the Pexels rate limit. The
 * function is fire-and-forget — it logs but never throws so it cannot crash
 * the server.
 */
export async function prewarmTopicImages(): Promise<{ generated: number; skipped: number; failed: number }> {
  const counts = { generated: 0, skipped: 0, failed: 0 };
  const { logger } = await import("../lib/logger");
  try {
    const existing = await db
      .select({
        topicSlug: courseTopicImagesTable.topicSlug,
        imageUrl: courseTopicImagesTable.imageUrl,
      })
      .from(courseTopicImagesTable);

    // Healthy cache: has a real (non-empty) imageUrl.
    const cachedSlugs = new Set(
      existing.filter((r) => !!r.imageUrl && r.imageUrl.length > 0).map((r) => r.topicSlug),
    );
    // Broken cache: row exists but the imageUrl is missing — needs a re-fetch.
    const brokenSlugs = new Set(
      existing.filter((r) => !r.imageUrl || r.imageUrl.length === 0).map((r) => r.topicSlug),
    );
    counts.skipped = cachedSlugs.size;

    const missing = COURSE_TOPICS.filter(
      (t) => !cachedSlugs.has(t.slug) || brokenSlugs.has(t.slug),
    );

    if (missing.length === 0) {
      logger.info({ skipped: counts.skipped }, "Pre-warm: all topic hero images already cached");
      return counts;
    }

    logger.info(
      { missing: missing.length, broken: brokenSlugs.size },
      "Pre-warming topic hero images",
    );

    for (const topic of missing) {
      try {
        const photo = await getRealTopicImage(topic);
        // If the row already exists but was broken, update it instead of insert.
        const existingRow = existing.find((r) => r.topicSlug === topic.slug);
        if (existingRow) {
          await db
            .update(courseTopicImagesTable)
            .set({
              imageUrl: photo.url,
              photographerName: photo.photographerName,
              photographerUrl: photo.photographerUrl,
            })
            .where(eq(courseTopicImagesTable.topicSlug, topic.slug));
        } else {
          await db
            .insert(courseTopicImagesTable)
            .values({
              topicSlug: topic.slug,
              imageUrl: photo.url,
              photographerName: photo.photographerName,
              photographerUrl: photo.photographerUrl,
            })
            .onConflictDoNothing();
        }
        counts.generated += 1;
        logger.info({ slug: topic.slug }, "Topic image pre-warmed");
      } catch (err) {
        counts.failed += 1;
        logger.error({ err, slug: topic.slug }, "Failed to pre-warm topic image");
        // Continue with remaining topics even if one fails
      }
    }
    return counts;
  } catch (err) {
    // If we can't even query the DB, log and bail — don't crash the server
    logger.error({ err }, "prewarmTopicImages: unexpected error");
    return counts;
  }
}

/**
 * Called once at server startup. Generates and caches illustrations for the
 * free lessons in every topic (isPremium: false — first 4 per topic = 24 total)
 * so the first student to open any free lesson never waits 30-60 s for the
 * image to be generated on-demand.
 *
 * Re-entrant: also re-fetches rows whose `imageUrl` is NULL or empty.
 * Generation is sequential and fire-and-forget — it logs but never throws.
 */
export async function prewarmLessonImages(): Promise<{ generated: number; skipped: number; failed: number }> {
  const counts = { generated: 0, skipped: 0, failed: 0 };
  const { logger } = await import("../lib/logger");
  try {
    // Build the full list of free-lesson (topic, lessonIndex) pairs
    const freeLessons: Array<{ topic: CourseTopic; lessonIndex: number }> = [];
    for (const topic of COURSE_TOPICS) {
      for (let i = 0; i < topic.lessons.length; i++) {
        if (!topic.lessons[i].isPremium) {
          freeLessons.push({ topic, lessonIndex: i });
        }
      }
    }

    // Fetch rows already in courseLessonImagesTable so we can skip the healthy ones.
    const existing = await db
      .select({
        topic: courseLessonImagesTable.topic,
        lessonIndex: courseLessonImagesTable.lessonIndex,
        imageUrl: courseLessonImagesTable.imageUrl,
      })
      .from(courseLessonImagesTable);

    const cachedSet = new Set(
      existing
        .filter((r) => !!r.imageUrl && r.imageUrl.length > 0)
        .map((r) => `${r.topic}:${r.lessonIndex}`),
    );
    const brokenSet = new Set(
      existing
        .filter((r) => !r.imageUrl || r.imageUrl.length === 0)
        .map((r) => `${r.topic}:${r.lessonIndex}`),
    );
    counts.skipped = cachedSet.size;

    const missing = freeLessons.filter(
      ({ topic, lessonIndex }) => !cachedSet.has(`${topic.slug}:${lessonIndex}`) || brokenSet.has(`${topic.slug}:${lessonIndex}`),
    );

    if (missing.length === 0) {
      logger.info({ skipped: counts.skipped }, "Pre-warm: all free lesson images already cached");
      return counts;
    }

    logger.info(
      { missing: missing.length, broken: brokenSet.size },
      "Pre-warming free lesson images",
    );

    for (const { topic, lessonIndex } of missing) {
      try {
        const photo = await getRealLessonImage(topic, lessonIndex);

        const key = `${topic.slug}:${lessonIndex}`;
        const existingRow = existing.find((r) => `${r.topic}:${r.lessonIndex}` === key);
        if (existingRow) {
          await db
            .update(courseLessonImagesTable)
            .set({
              imageUrl: photo.url,
              photographerName: photo.photographerName,
              photographerUrl: photo.photographerUrl,
            })
            .where(
              and(
                eq(courseLessonImagesTable.topic, topic.slug),
                eq(courseLessonImagesTable.lessonIndex, lessonIndex),
              ),
            );
        } else {
          await db
            .insert(courseLessonImagesTable)
            .values({
              topic: topic.slug,
              lessonIndex,
              imageUrl: photo.url,
              photographerName: photo.photographerName,
              photographerUrl: photo.photographerUrl,
            })
            .onConflictDoNothing();
        }
        counts.generated += 1;
        logger.info({ slug: topic.slug, lessonIndex }, "Lesson image pre-warmed");
      } catch (err) {
        counts.failed += 1;
        logger.error({ err, slug: topic.slug, lessonIndex }, "Failed to pre-warm lesson image");
        // Continue with remaining lessons even if one fails
      }
    }
    return counts;
  } catch (err) {
    logger.error({ err }, "prewarmLessonImages: unexpected error");
    return counts;
  }
}

/**
 * Called once at server startup. Generates and caches the 3 step images for
 * every free lesson (isPremium: false) in every topic (24 lessons × 3 steps =
 * 72 images total) so the Visual Guide panel is always populated immediately
 * for free students.
 *
 * Re-entrant: also re-fetches rows whose `imageUrl` is NULL or empty.
 * Photos for a given lesson are fetched in a single getStepPhotos call, then
 * each step is inserted/updated individually. Generation is sequential and
 * fire-and-forget — it logs but never throws so it cannot crash the server.
 */
export async function prewarmLessonStepImages(): Promise<{ generated: number; skipped: number; failed: number }> {
  const counts = { generated: 0, skipped: 0, failed: 0 };
  const { logger } = await import("../lib/logger");
  try {
    // Build the full list of free-lesson (topic, lessonIndex) pairs
    const freeLessons: Array<{ topic: CourseTopic; lessonIndex: number }> = [];
    for (const topic of COURSE_TOPICS) {
      for (let i = 0; i < topic.lessons.length; i++) {
        if (!topic.lessons[i].isPremium) {
          freeLessons.push({ topic, lessonIndex: i });
        }
      }
    }

    // Fetch all already-cached step image rows
    const existing = await db
      .select({
        topic: courseLessonStepImagesTable.topic,
        lessonIndex: courseLessonStepImagesTable.lessonIndex,
        stepNumber: courseLessonStepImagesTable.stepNumber,
        imageUrl: courseLessonStepImagesTable.imageUrl,
      })
      .from(courseLessonStepImagesTable);

    // Build sets of cached (healthy) and broken (missing imageUrl) keys.
    const cachedSet = new Set(
      existing
        .filter((r) => !!r.imageUrl && r.imageUrl.length > 0)
        .map((r) => `${r.topic}:${r.lessonIndex}:${r.stepNumber}`),
    );
    const brokenSet = new Set(
      existing
        .filter((r) => !r.imageUrl || r.imageUrl.length === 0)
        .map((r) => `${r.topic}:${r.lessonIndex}:${r.stepNumber}`),
    );

    const STEPS = [
      { number: 0, label: "What You'll Build" },
      { number: 1, label: "How to Build It" },
      { number: 2, label: "Final Result" },
    ];

    // Count how many step images are missing across all free lessons
    const missingLessons = freeLessons.filter(({ topic, lessonIndex }) =>
      STEPS.some(
        (s) =>
          !cachedSet.has(`${topic.slug}:${lessonIndex}:${s.number}`) ||
          brokenSet.has(`${topic.slug}:${lessonIndex}:${s.number}`),
      ),
    );

    if (missingLessons.length === 0) {
      logger.info(
        { cached: cachedSet.size },
        "Pre-warm: all free lesson step images already cached",
      );
      counts.skipped = cachedSet.size;
      return counts;
    }

    const totalMissing = missingLessons.reduce(
      (sum, { topic, lessonIndex }) =>
        sum +
        STEPS.filter(
          (s) =>
            !cachedSet.has(`${topic.slug}:${lessonIndex}:${s.number}`) ||
            brokenSet.has(`${topic.slug}:${lessonIndex}:${s.number}`),
        ).length,
      0,
    );
    logger.info(
      { lessons: missingLessons.length, stepImages: totalMissing, broken: brokenSet.size },
      "Pre-warming free lesson step images",
    );

    for (const { topic, lessonIndex } of missingLessons) {
      const missingSteps = STEPS.filter(
        (s) =>
          !cachedSet.has(`${topic.slug}:${lessonIndex}:${s.number}`) ||
          brokenSet.has(`${topic.slug}:${lessonIndex}:${s.number}`),
      );
      if (missingSteps.length === 0) continue;

      try {
        // One photo API call returns all 3 photos for this lesson
        const stepPhotos = await getStepPhotos(topic.slug, lessonIndex);

        for (const step of missingSteps) {
          const photo = stepPhotos[step.number] ?? stepPhotos[0];
          // If we don't have a real photo (rare fallback failure), leave the
          // row absent rather than inserting a placeholder that would render
          // the wrong step image later.
          if (!photo) {
            counts.failed += 1;
            continue;
          }
          const key = `${topic.slug}:${lessonIndex}:${step.number}`;
          const existingRow = existing.find(
            (r) => `${r.topic}:${r.lessonIndex}:${r.stepNumber}` === key,
          );
          if (existingRow) {
            await db
              .update(courseLessonStepImagesTable)
              .set({
                imageUrl: photo.url,
                photographerName: photo.photographerName,
                photographerUrl: photo.photographerUrl,
              })
              .where(
                and(
                  eq(courseLessonStepImagesTable.topic, topic.slug),
                  eq(courseLessonStepImagesTable.lessonIndex, lessonIndex),
                  eq(courseLessonStepImagesTable.stepNumber, step.number),
                ),
              );
          } else {
            await db
              .insert(courseLessonStepImagesTable)
              .values({
                topic: topic.slug,
                lessonIndex,
                stepNumber: step.number,
                stepLabel: step.label,
                imageUrl: photo.url,
                photographerName: photo.photographerName,
                photographerUrl: photo.photographerUrl,
              })
              .onConflictDoNothing();
          }
          counts.generated += 1;
        }
        logger.info({ slug: topic.slug, lessonIndex, steps: missingSteps.length }, "Lesson step images pre-warmed");
      } catch (err) {
        counts.failed += missingSteps.length;
        logger.error({ err, slug: topic.slug, lessonIndex }, "Failed to pre-warm lesson step images");
        // Continue with remaining lessons even if one fails
      }
    }
    return counts;
  } catch (err) {
    logger.error({ err }, "prewarmLessonStepImages: unexpected error");
    return counts;
  }
}

// ─── Image routes ─────────────────────────────────────────────────────────────

// GET /courses/image/topic/:slug
// Returns (and lazily generates) a cached hero illustration for a topic card.
router.get("/courses/image/topic/:slug", requireAuth, async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const topic = COURSE_TOPICS.find((t) => t.slug === slug);
  if (!topic) { res.status(404).json({ error: "Unknown topic." }); return; }

  const [cached] = await db
    .select({
      imageUrl: courseTopicImagesTable.imageUrl,
      photographerName: courseTopicImagesTable.photographerName,
      photographerUrl: courseTopicImagesTable.photographerUrl,
    })
    .from(courseTopicImagesTable)
    .where(eq(courseTopicImagesTable.topicSlug, slug))
    .limit(1);

  if (cached) { res.json(cached); return; }

  try {
    const photo = await getRealTopicImage(topic);
    await db
      .insert(courseTopicImagesTable)
      .values({ topicSlug: slug, imageUrl: photo.url, photographerName: photo.photographerName, photographerUrl: photo.photographerUrl })
      .onConflictDoNothing();
    res.json({ imageUrl: photo.url, photographerName: photo.photographerName, photographerUrl: photo.photographerUrl });
  } catch (err) {
    (req as any).log?.error({ err }, "topic image fetch failed");
    res.status(502).json({ error: "Could not load image." });
  }
});

// GET /courses/image/lesson/:slug/:index
// Returns (and lazily generates) a cached illustration for a specific lesson.
// Uses courseLessonImagesTable — completely separate from courseLessonCacheTable
// so image generation can never corrupt or block lesson content caching.
router.get("/courses/image/lesson/:slug/:index", requireAuth, async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const idx = Number(req.params.index);
  const topic = COURSE_TOPICS.find((t) => t.slug === slug);
  if (!topic || !Number.isInteger(idx) || idx < 0 || idx >= topic.lessons.length) {
    res.status(404).json({ error: "Unknown lesson." }); return;
  }

  const [cached] = await db
    .select({
      imageUrl: courseLessonImagesTable.imageUrl,
      photographerName: courseLessonImagesTable.photographerName,
      photographerUrl: courseLessonImagesTable.photographerUrl,
    })
    .from(courseLessonImagesTable)
    .where(and(eq(courseLessonImagesTable.topic, slug), eq(courseLessonImagesTable.lessonIndex, idx)))
    .limit(1);

  if (cached) { res.json(cached); return; }

  try {
    const photo = await getRealLessonImage(topic, idx);
    await db
      .insert(courseLessonImagesTable)
      .values({ topic: slug, lessonIndex: idx, imageUrl: photo.url, photographerName: photo.photographerName, photographerUrl: photo.photographerUrl })
      .onConflictDoNothing();
    res.json({ imageUrl: photo.url, photographerName: photo.photographerName, photographerUrl: photo.photographerUrl });
  } catch (err) {
    (req as any).log?.error({ err }, "lesson image fetch failed");
    res.status(502).json({ error: "Could not load image." });
  }
});

// GET /courses/image/lesson/:slug/:index/steps
// Returns 3 step-by-step visual guide illustrations per lesson:
//   step 0 = The Concept, 1 = How It Works, 2 = Real-World Use
// Cached globally in courseLessonStepImagesTable; generated lazily on first request.
router.get("/courses/image/lesson/:slug/:index/steps", requireAuth, async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const idx = Number(req.params.index);
  const topic = COURSE_TOPICS.find((t) => t.slug === slug);
  if (!topic || !Number.isInteger(idx) || idx < 0 || idx >= topic.lessons.length) {
    res.status(404).json({ error: "Unknown lesson." }); return;
  }
  const lesson = topic.lessons[idx];

  const existing = await db
    .select()
    .from(courseLessonStepImagesTable)
    .where(and(eq(courseLessonStepImagesTable.topic, slug), eq(courseLessonStepImagesTable.lessonIndex, idx)));
  const cachedMap = new Map(existing.map((r) => [r.stepNumber, r]));

  const STEPS = [
    { number: 0, label: "What You'll Build",  hint: "the finished project or outcome of this lesson — show the end result, the thing being built" },
    { number: 1, label: "How to Build It",    hint: "a student mid-build, showing hands working on components, wiring, or code — the active construction process" },
    { number: 2, label: "Final Result",       hint: "the completed, working project in a real environment — powered on, running, or in use" },
  ];

  const results: { stepNumber: number; stepLabel: string; imageUrl: string; photographerName: string | null; photographerUrl: string | null }[] = [];

  // Fetch the three-photo tuple at most once for all missing steps —
  // calling getStepPhotos per step would triple the Pexels API usage.
  let stepPhotos: Awaited<ReturnType<typeof getStepPhotos>> | null = null;

  for (const step of STEPS) {
    if (cachedMap.has(step.number)) {
      const row = cachedMap.get(step.number)!;
      results.push({ stepNumber: step.number, stepLabel: step.label, imageUrl: row.imageUrl, photographerName: row.photographerName, photographerUrl: row.photographerUrl });
      continue;
    }
    try {
      stepPhotos ??= await getStepPhotos(topic.slug, idx);
      const photo = stepPhotos[step.number] ?? stepPhotos[0];
      await db.insert(courseLessonStepImagesTable)
        .values({ topic: slug, lessonIndex: idx, stepNumber: step.number, stepLabel: step.label, imageUrl: photo.url, photographerName: photo.photographerName, photographerUrl: photo.photographerUrl })
        .onConflictDoNothing();
      results.push({ stepNumber: step.number, stepLabel: step.label, imageUrl: photo.url, photographerName: photo.photographerName, photographerUrl: photo.photographerUrl });
    } catch (err) {
      (req as any).log?.error({ err, step: step.number }, "step image fetch failed");
    }
  }

  results.sort((a, b) => a.stepNumber - b.stepNumber);
  res.json({ steps: results });
});

// ─── Image cache status & repair (owner-only) ─────────────────────────────────

// GET /courses/images/status
// Returns which of the 6 topic hero images are cached and which are missing,
// plus per-topic lesson illustration coverage (cached vs total vs missing indices).
// Use this to verify the pre-warm job ran successfully after a deploy.
router.get("/courses/images/status", async (req, res): Promise<void> => {
  if (!(await isOwnerRequest(req))) {
    res.status(403).json({ error: "Owner access required." });
    return;
  }

  // ── Hero images ──────────────────────────────────────────────────────────
  const heroRows = await db
    .select({ topicSlug: courseTopicImagesTable.topicSlug, generatedAt: courseTopicImagesTable.generatedAt })
    .from(courseTopicImagesTable);

  const heroCachedMap = new Map(heroRows.map((r) => [r.topicSlug, r.generatedAt]));

  const topics = COURSE_TOPICS.map((t) => ({
    slug: t.slug,
    title: t.title,
    cached: heroCachedMap.has(t.slug),
    generatedAt: heroCachedMap.get(t.slug) ?? null,
  }));

  // ── Lesson illustrations ─────────────────────────────────────────────────
  const lessonRows = await db
    .select({ topic: courseLessonImagesTable.topic, lessonIndex: courseLessonImagesTable.lessonIndex })
    .from(courseLessonImagesTable);

  // Build a set of "topic:index" keys for fast lookup
  const lessonCachedSet = new Set(lessonRows.map((r) => `${r.topic}:${r.lessonIndex}`));

  const lessonTopics = COURSE_TOPICS.map((t) => {
    const totalLessons = t.lessons.length;
    const cachedIndices: number[] = [];
    const missingIndices: number[] = [];

    for (let i = 0; i < totalLessons; i++) {
      if (lessonCachedSet.has(`${t.slug}:${i}`)) {
        cachedIndices.push(i);
      } else {
        missingIndices.push(i);
      }
    }

    return {
      slug: t.slug,
      title: t.title,
      totalLessons,
      cachedCount: cachedIndices.length,
      missingCount: missingIndices.length,
      missingIndices,
    };
  });

  const totalLessonSlots = lessonTopics.reduce((sum, t) => sum + t.totalLessons, 0);
  const totalLessonsCached = lessonTopics.reduce((sum, t) => sum + t.cachedCount, 0);

  res.json({
    heroImages: {
      total: COURSE_TOPICS.length,
      cached: topics.filter((t) => t.cached).length,
      missing: topics.filter((t) => !t.cached).length,
      topics,
    },
    lessonImages: {
      total: totalLessonSlots,
      cached: totalLessonsCached,
      missing: totalLessonSlots - totalLessonsCached,
      topics: lessonTopics,
    },
  });
});

// POST /courses/images/status
// Re-triggers image generation for any topic slugs that are not yet cached.
// Safe to call repeatedly — skips topics that already have an image.
router.post("/courses/images/status", async (req, res): Promise<void> => {
  if (!(await isOwnerRequest(req))) {
    res.status(403).json({ error: "Owner access required." });
    return;
  }

  const existing = await db
    .select({ topicSlug: courseTopicImagesTable.topicSlug })
    .from(courseTopicImagesTable);
  const cachedSlugs = new Set(existing.map((r) => r.topicSlug));
  const missing = COURSE_TOPICS.filter((t) => !cachedSlugs.has(t.slug));

  if (missing.length === 0) {
    res.json({ generated: 0, skipped: COURSE_TOPICS.length, results: [] });
    return;
  }

  const results: { slug: string; success: boolean; error?: string }[] = [];
  for (const topic of missing) {
    try {
      const photo = await getRealTopicImage(topic);
      await db
        .insert(courseTopicImagesTable)
        .values({ topicSlug: topic.slug, imageUrl: photo.url, photographerName: photo.photographerName, photographerUrl: photo.photographerUrl })
        .onConflictDoNothing();
      results.push({ slug: topic.slug, success: true });
    } catch (err: any) {
      results.push({ slug: topic.slug, success: false, error: err?.message ?? String(err) });
    }
  }

  res.json({
    generated: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    skipped: cachedSlugs.size,
    results,
  });
});

// POST /courses/cache/clear
// Owner-only. Deletes cached lesson TEXT so it regenerates with the current
// prompt. Lesson content is cached globally and forever, so after changing the
// generation prompt (e.g. tightening the accuracy rules) existing students
// would keep reading the old text indefinitely without this.
//
// Only touches courseLessonCacheTable — the image tables are deliberately
// separate so clearing text never costs a round of image regeneration.
// Optional body: { topic?: string } to clear a single topic.
router.post("/courses/cache/clear", async (req, res): Promise<void> => {
  if (!(await isOwnerRequest(req))) {
    res.status(403).json({ error: "Owner access required." });
    return;
  }

  const topicSlug = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";

  if (topicSlug) {
    const known = COURSE_TOPICS.some((t) => t.slug === topicSlug);
    if (!known) {
      res.status(404).json({ error: "Unknown topic." });
      return;
    }
    const deleted = await db
      .delete(courseLessonCacheTable)
      .where(eq(courseLessonCacheTable.topic, topicSlug))
      .returning({ id: courseLessonCacheTable.id });
    res.json({ cleared: deleted.length, topic: topicSlug });
    return;
  }

  const deleted = await db
    .delete(courseLessonCacheTable)
    .returning({ id: courseLessonCacheTable.id });
  res.json({ cleared: deleted.length, topic: null });
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /courses/overview
router.get("/courses/overview", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;

  const [user] = await db
    .select({ premiumExpiresAt: usersTable.premiumExpiresAt })
    .from(usersTable)
    .where(eq(usersTable.userId, userId))
    .limit(1);

  const isOwner = await isOwnerRequest(req);
  const isPremium = isOwner || isPremiumActive(user?.premiumExpiresAt);

  const used = isPremium ? 0 : await getLessonsGeneratedToday(userId);
  const progressRows = await db
    .select({ topic: courseProgressTable.topic, lessonIndex: courseProgressTable.lessonIndex })
    .from(courseProgressTable)
    .where(eq(courseProgressTable.userId, userId));

  const completedMap: Record<string, Set<number>> = {};
  for (const r of progressRows) {
    if (!completedMap[r.topic]) completedMap[r.topic] = new Set();
    completedMap[r.topic].add(r.lessonIndex);
  }

  const topics = COURSE_TOPICS.map((t) => ({
    slug: t.slug,
    title: t.title,
    emoji: t.emoji,
    description: t.description,
    color: t.color,
    totalLessons: t.lessons.length,
    completedLessons: completedMap[t.slug]?.size ?? 0,
    lessons: t.lessons.map((l, i) => ({
      index: i,
      title: l.title,
      summary: l.summary,
      isPremium: l.isPremium,
      completed: completedMap[t.slug]?.has(i) ?? false,
    })),
  }));

  res.json({
    topics,
    limits: {
      isPremium,
      dailyLimit: isPremium ? null : FREE_DAILY_LESSONS,
      used: isPremium ? 0 : used,
      remaining: isPremium ? null : Math.max(0, FREE_DAILY_LESSONS - used),
    },
  });
});

// POST /courses/lesson  { topic: string, lessonIndex: number }
router.post("/courses/lesson", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { topic: topicSlug, lessonIndex } = req.body ?? {};

  const topic = COURSE_TOPICS.find((t) => t.slug === topicSlug);
  if (!topic) {
    res.status(400).json({ error: "Unknown course topic." });
    return;
  }
  const idx = Number(lessonIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= topic.lessons.length) {
    res.status(400).json({ error: "Invalid lesson index." });
    return;
  }
  const lesson = topic.lessons[idx];

  // Tier check for premium-locked lessons
  const [user] = await db
    .select({ premiumExpiresAt: usersTable.premiumExpiresAt })
    .from(usersTable)
    .where(eq(usersTable.userId, userId))
    .limit(1);
  const isOwner = await isOwnerRequest(req);
  const isPremium = isOwner || isPremiumActive(user?.premiumExpiresAt);

  if (lesson.isPremium && !isPremium) {
    res.status(403).json({ error: "This lesson requires Premium.", upgrade: true });
    return;
  }

  // Daily limit check for free users
  if (!isPremium) {
    const used = await getLessonsGeneratedToday(userId);
    if (used >= FREE_DAILY_LESSONS) {
      res.status(429).json({
        error: `You've used your ${FREE_DAILY_LESSONS} free lessons for today. Come back tomorrow or upgrade to Premium for unlimited lessons.`,
        upgrade: true,
      });
      return;
    }
  }

  // Return cached content if available
  const [cached] = await db
    .select({ content: courseLessonCacheTable.content })
    .from(courseLessonCacheTable)
    .where(
      and(
        eq(courseLessonCacheTable.topic, topic.slug),
        eq(courseLessonCacheTable.lessonIndex, idx),
      ),
    )
    .limit(1);

  // Guard: treat an empty-content row as a cache miss (defensive against any
  // legacy stub rows created before the dedicated courseLessonImagesTable).
  if (cached?.content) {
    res.json({ content: cached.content, cached: true });
    return;
  }

  // Generate new content
  try {
    const content = await generateLessonContent(topic, lesson);
    if (!content) {
      res.status(502).json({ error: "AI did not return lesson content. Please try again." });
      return;
    }

    // Cache it globally — use upsert so any legacy empty-content stub is overwritten.
    await db
      .insert(courseLessonCacheTable)
      .values({ topic: topic.slug, lessonIndex: idx, content })
      .onConflictDoUpdate({
        target: [courseLessonCacheTable.topic, courseLessonCacheTable.lessonIndex],
        set: { content },
      });

    // Count usage for free users (only on fresh generation)
    if (!isPremium) {
      await incrementLessonUsage(userId);
    }

    res.json({ content, cached: false });
  } catch (err) {
    (req as any).log?.error({ err }, "course lesson generation failed");
    res.status(502).json({ error: "Could not generate lesson. Please try again." });
  }
});

// POST /courses/lesson/complete  { topic: string, lessonIndex: number }
router.post("/courses/lesson/complete", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { topic: topicSlug, lessonIndex } = req.body ?? {};

  const topic = COURSE_TOPICS.find((t) => t.slug === topicSlug);
  if (!topic) {
    res.status(400).json({ error: "Unknown course topic." });
    return;
  }
  const idx = Number(lessonIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= topic.lessons.length) {
    res.status(400).json({ error: "Invalid lesson index." });
    return;
  }

  await db
    .insert(courseProgressTable)
    .values({ userId, topic: topicSlug, lessonIndex: idx })
    .onConflictDoNothing();

  res.json({ ok: true });
});

// POST /courses/quiz  { topic: string, lessonIndex: number }
// Premium-only: generates 5 multiple-choice practice questions for a lesson.
router.post("/courses/quiz", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { topic: topicSlug, lessonIndex } = req.body ?? {};

  const topic = COURSE_TOPICS.find((t) => t.slug === topicSlug);
  if (!topic) { res.status(400).json({ error: "Unknown course topic." }); return; }
  const idx = Number(lessonIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= topic.lessons.length) {
    res.status(400).json({ error: "Invalid lesson index." }); return;
  }
  const lesson = topic.lessons[idx];

  const [user] = await db
    .select({ premiumExpiresAt: usersTable.premiumExpiresAt })
    .from(usersTable)
    .where(eq(usersTable.userId, userId))
    .limit(1);
  const isOwner = await isOwnerRequest(req);
  const isPremium = isOwner || isPremiumActive(user?.premiumExpiresAt);

  if (!isPremium) {
    res.status(403).json({ error: "AI Practice Quiz requires Premium.", upgrade: true });
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: PREMIUM_AI_MODEL,
      max_tokens: 1500,
      messages: [
        {
          role: "system",
          content:
            "You are LearnMate AI's quiz generator. Generate exactly 5 multiple-choice questions " +
            "based on a tech lesson for students aged 13-20.\n" +
            "ACCURACY RULES — a wrong answer key teaches the student the wrong thing:\n" +
            "• Exactly one option must be correct, and the answer letter must match it.\n" +
            "• Every fact, figure and code snippet must be technically correct and real.\n" +
            "• Wrong options must be plausible misconceptions, never absurd or joke answers.\n" +
            "• Do not write questions about material the lesson does not cover.\n" +
            "• Plain text only: no HTML tags and no HTML entities.\n" +
            "Return ONLY valid JSON — no markdown, no explanation, no code fences. " +
            'Format: {"questions":[{"q":"...","options":["A)...","B)...","C)...","D)..."],"answer":"A"},...]}',
        },
        {
          role: "user",
          content: `Generate 5 multiple-choice questions for the lesson:\nTopic: ${topic.title}\nLesson: ${lesson.title}\nSummary: ${lesson.summary}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    // Models often wrap JSON in ```json fences despite being told not to;
    // strip them rather than failing the whole request.
    const unfenced = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = JSON.parse(unfenced);
    if (!Array.isArray(parsed.questions)) throw new Error("bad format");
    res.json({ questions: parsed.questions });
  } catch (err) {
    (req as any).log?.error({ err }, "quiz generation failed");
    res.status(502).json({ error: "Could not generate quiz. Please try again." });
  }
});

/** Internals exposed for unit tests only. Not part of the route surface. */
export const __test = { generateLessonContent };

export default router;
