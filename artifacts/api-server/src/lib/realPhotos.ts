/**
 * Real photo search using the Pexels API (free, 200 req/hour).
 * Get a free key at https://www.pexels.com/api/
 *
 * Every query is tuned to return genuine student-in-the-lab / project photos.
 * Falls back to a curated set of reliable real photo URLs when Pexels is
 * unavailable or the key is missing.
 */

// ─── Pexels types ────────────────────────────────────────────────────────────

interface PexelsPhoto {
  id: number;
  src: { original: string; large2x: string; large: string; medium: string };
  photographer: string;
  photographer_url: string;
  alt: string;
}

/** A photo plus its Pexels attribution. Curated fallbacks have null attribution. */
export interface PhotoResult {
  url: string;
  photographerName: string | null;
  photographerUrl: string | null;
}

function fallbackPhoto(url: string): PhotoResult {
  return { url, photographerName: null, photographerUrl: null };
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[];
  total_results: number;
}

// ─── Topic-level photo queries ────────────────────────────────────────────────
// One iconic image that immediately tells the student what this course is about.

const TOPIC_PHOTO_QUERIES: Record<string, string> = {
  robotics:        "Arduino Uno microcontroller board",
  electronics:     "breadboard LED resistor components",
  python:          "Python programming code screen",
  cpp:             "C++ code programming terminal",
  "ai-ml":         "artificial intelligence neural network",
  "coding-basics": "programming code laptop beginner",
};

// ─── Per-lesson photo queries ─────────────────────────────────────────────────
// Each query targets the exact hardware component, software concept, or visual
// that a student would see if they searched for that specific topic.

const LESSON_PHOTO_QUERIES: Record<string, string> = {
  // ── Robotics ─────────────────────────────────────────────────────────────
  "robotics:0":  "robot autonomous wheeled machine",           // What is a Robot?
  "robotics:1":  "Arduino Uno sensor servo motor board",       // Robot Parts
  "robotics:2":  "ultrasonic distance sensor HC-SR04",         // How Robots Sense
  "robotics:3":  "servo motor DC motor gear robot",            // How Robots Move
  "robotics:4":  "Arduino Uno board USB cable beginner",       // Intro to Arduino
  "robotics:5":  "Arduino LED breadboard code laptop",         // Writing Commands
  "robotics:6":  "line following robot IR sensor tape",        // Line-Following Robot
  "robotics:7":  "robot programming autonomous code",          // Programming Behaviors
  "robotics:8":  "remote control RC transmitter receiver",     // Remote-Controlled Robot
  "robotics:9":  "robot safety team student lab",              // Robot Safety
  "robotics:10": "autonomous navigation obstacle robot",       // Autonomous Navigation
  "robotics:11": "camera computer vision object detection",    // Computer Vision
  "robotics:12": "FIRST robotics competition team student",    // Real-World Projects
  "robotics:13": "humanoid robot future technology",           // Future of Robotics

  // ── Electronics ──────────────────────────────────────────────────────────
  "electronics:0":  "electricity power lines energy bulb",           // What is Electricity?
  "electronics:1":  "multimeter digital measurement voltage",         // Voltage Current Resistance
  "electronics:2":  "circuit diagram schematic paper pen",            // Reading a Circuit Diagram
  "electronics:3":  "resistor capacitor LED component close-up",      // Resistors Capacitors LEDs
  "electronics:4":  "breadboard jumper wires components",             // How a Breadboard Works
  "electronics:5":  "LED glowing circuit breadboard battery",         // Building Your First Circuit
  "electronics:6":  "transistor electronic component magnified",      // Introduction to Transistors
  "electronics:7":  "diode electronic component semiconductor",       // Diodes and Rectifiers
  "electronics:8":  "oscilloscope wave signal electronics bench",     // Basic Amplifier Circuits
  "electronics:9":  "power supply unit voltage AC DC adapter",        // Power Supplies Explained
  "electronics:10": "integrated circuit chip microchip close-up",     // Introduction to ICs
  "electronics:11": "logic gate digital circuit chip board",          // Digital vs Analogue
  "electronics:12": "PCB green circuit board manufacturing",          // PCB Design Basics
  "electronics:13": "smartphone motherboard internal components",      // Electronics in Everyday Products

  // ── Python ───────────────────────────────────────────────────────────────
  "python:0":  "Python logo programming language code",         // What is Python?
  "python:1":  "Python variables code screen terminal",         // Variables & Data Types
  "python:2":  "Python terminal print input command line",      // print() & input()
  "python:3":  "Python if else statement code screen",          // If Statements & Logic
  "python:4":  "Python for loop while loop code screen",        // Loops
  "python:5":  "Python function def return code screen",        // Functions
  "python:6":  "Python list dictionary data structure code",    // Lists & Dictionaries
  "python:7":  "Python file CSV read write code",               // Working with Files
  "python:8":  "Python class object OOP code screen",           // OOP Basics
  "python:9":  "Python error exception try except debugging",   // Error Handling
  "python:10": "Python library numpy pandas import",            // Standard Libraries
  "python:11": "Python calculator terminal project code",       // Building a Calculator App
  "python:12": "Python API JSON request web data",              // Introduction to APIs
  "python:13": "Python matplotlib chart graph data analysis",   // First Data Analysis

  // ── C++ ──────────────────────────────────────────────────────────────────
  "cpp:0":  "game development C++ engine code",               // What is C++?
  "cpp:1":  "terminal Hello World compile code screen",        // First C++ Program
  "cpp:2":  "C++ int float variable data type code",           // Variables & Data Types
  "cpp:3":  "keyboard terminal cin cout input output",         // Input & Output
  "cpp:4":  "C++ if loop conditional code terminal",           // Conditionals & Loops
  "cpp:5":  "C++ function parameter return value code",        // Functions in C++
  "cpp:6":  "C++ array string vector data code",               // Arrays & Strings
  "cpp:7":  "memory pointer address programming C++",          // Pointers and References
  "cpp:8":  "object oriented programming class diagram",       // OOP in C++
  "cpp:9":  "C++ class constructor object code screen",        // Classes and Objects
  "cpp:10": "C++ inheritance derived class hierarchy",         // Inheritance Explained
  "cpp:11": "C++ file fstream read write disk",                // File Input and Output
  "cpp:12": "C++ STL vector map algorithm code",               // Standard Template Library
  "cpp:13": "video game text adventure terminal C++",          // Building a Simple Game

  // ── AI & Machine Learning ─────────────────────────────────────────────────
  "ai-ml:0":  "artificial intelligence concept brain chip",        // What is AI?
  "ai-ml:1":  "machine learning training data graph chart",        // How Do Machines Learn?
  "ai-ml:2":  "decision tree flowchart rule based AI",             // Rules vs Learning
  "ai-ml:3":  "ChatGPT AI chatbot interface laptop",               // How ChatGPT Works
  "ai-ml:4":  "neural network diagram layers nodes deep learning", // What is a Neural Network?
  "ai-ml:5":  "facial recognition smartphone AI everyday life",    // AI in Everyday Life
  "ai-ml:6":  "student AI tool laptop study productivity",         // Using AI Tools
  "ai-ml:7":  "machine learning model training Python dataset",    // Training Your First Model
  "ai-ml:8":  "dataset spreadsheet CSV data quality",              // Understanding Datasets
  "ai-ml:9":  "AI ethics bias fairness diversity technology",      // Bias and Fairness in AI
  "ai-ml:10": "computer vision camera object detection recognition", // Computer Vision Basics
  "ai-ml:11": "natural language processing NLP text analysis",     // NLP
  "ai-ml:12": "AI ethics privacy data responsibility",             // AI Ethics
  "ai-ml:13": "data scientist AI career technology office",        // Careers in AI

  // ── Coding Basics ─────────────────────────────────────────────────────────
  "coding-basics:0":  "computer program code laptop screen",         // What is a Computer Program?
  "coding-basics:1":  "variable programming memory storage code",    // Variables
  "coding-basics:2":  "logic flowchart decision tree programming",   // Logic & Decisions
  "coding-basics:3":  "loop repeat code iteration terminal",         // Loops
  "coding-basics:4":  "function building blocks code reusable",      // Functions
  "coding-basics:5":  "debugging bug error code laptop fix",         // Debugging
  "coding-basics:6":  "internet server network data center cable",   // How the Internet Works
  "coding-basics:7":  "algorithm flowchart steps diagram paper",     // Algorithms Step by Step
  "coding-basics:8":  "data structure array list diagram",           // Data Structures
  "coding-basics:9":  "git version control terminal branch commit",  // Version Control with Git
  "coding-basics:10": "API web request JSON server response",        // APIs
  "coding-basics:11": "database server SQL table rows data",         // Databases
  "coding-basics:12": "HTML CSS JavaScript browser code screen",     // Web Basics
  "coding-basics:13": "website HTML CSS laptop student project",     // Building Your First Website
};

// ─── Fallback curated photos ──────────────────────────────────────────────────
// Used when Pexels is unavailable. All URLs are real, publicly accessible photos.

const FALLBACK_TOPIC_PHOTOS: Record<string, string> = {
  robotics:
    "https://www.firstinspires.org/hs-fs/hubfs/20230420_bm_0312.jpg?width=630&height=420&name=20230420_bm_0312.jpg",
  electronics:
    "https://byu-cpe.github.io/ecen192/assets/02_breadboard/breadboard_setup_2.png",
  python:
    "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=900&q=80",
  cpp:
    "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=900&q=80",
  "ai-ml":
    "https://home-wordpress.deeplearning.ai/wp-content/uploads/2024/09/1004_ai-python-for-beginners.webp",
  "coding-basics":
    "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=900&q=80",
};

// Three step-image fallbacks per topic: [What You'll Build, How to Build It, Final Result]
const FALLBACK_STEP_PHOTOS: Record<string, [string, string, string]> = {
  robotics: [
    "https://i0.wp.com/signalcleveland.org/wp-content/uploads/2025/02/202501_ETRobotics-6.jpg?fit=1500%2C1200&ssl=1",
    "https://www.cs.utexas.edu/sites/default/files/styles/article/public/2024-02/hands-on-robotics-2023_3.jpg?itok=pgOypX0L",
    "https://www.firstinspires.org/hs-fs/hubfs/frc_getstarted_1260hero.webp?width=630&height=420&name=frc_getstarted_1260hero.webp",
  ],
  electronics: [
    "https://byu-cpe.github.io/ecen192/assets/02_breadboard/traffic_light_breadboard.jpg",
    "https://learn71.ca/isfeld-makerspace-2/wp-content/uploads/sites/39/2026/01/breadboard5-scaled.jpg",
    "https://byu-cpe.github.io/ecen192/assets/02_breadboard/front_breadboard.jpg",
  ],
  python: [
    "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=900&q=80",
    "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=900&q=80",
    "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=900&q=80",
  ],
  cpp: [
    "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=900&q=80",
    "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=900&q=80",
    "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=900&q=80",
  ],
  "ai-ml": [
    "https://home-wordpress.deeplearning.ai/wp-content/uploads/2024/09/1004_ai-python-for-beginners.webp",
    "https://ddls.aicell.io/course/ddls-2023/module-1/run-this-notebook.png",
    "https://files.realpython.com/media/neural_network_layers.c8fe82979288.png",
  ],
  "coding-basics": [
    "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=900&q=80",
    "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=900&q=80",
    "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=900&q=80",
  ],
};

// ─── Pexels search ────────────────────────────────────────────────────────────

async function pexelsSearch(query: string, perPage = 5): Promise<PhotoResult | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    // Logged once at module init (below) so the owner knows the Pexels
    // integration is disabled. Don't re-log on every call.
    return null;
  }

  try {
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("size", "large");

    const res = await fetch(url.toString(), {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as PexelsSearchResponse;
    const photo = data.photos?.[0];
    const photoUrl = photo?.src?.large2x ?? photo?.src?.large ?? null;
    if (!photoUrl) return null;
    return {
      url: photoUrl,
      photographerName: photo.photographer || null,
      photographerUrl: photo.photographer_url || null,
    };
  } catch {
    return null;
  }
}

// One-time startup breadcrumb so the owner knows whether Pexels is enabled.
if (!process.env.PEXELS_API_KEY) {
  // eslint-disable-next-line no-console
  console.info(
    "[realPhotos] PEXELS_API_KEY is not set — using curated fallback photos only. " +
      "Get a free key at https://www.pexels.com/api/ to enable per-topic photo search.",
  );
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Get a real photo URL for a course topic card hero image.
 */
export async function getTopicPhoto(slug: string): Promise<PhotoResult> {
  const query = TOPIC_PHOTO_QUERIES[slug] ?? `${slug} students technology course`;
  const pexels = await pexelsSearch(query, 5);
  if (pexels) return pexels;
  return fallbackPhoto(FALLBACK_TOPIC_PHOTOS[slug] ?? FALLBACK_TOPIC_PHOTOS["coding-basics"]);
}

/**
 * Get a real photo URL for a specific lesson.
 * Uses a lesson-specific query when available, falls back to topic query.
 */
export async function getLessonPhoto(
  topicSlug: string,
  lessonIndex: number,
): Promise<PhotoResult> {
  const key = `${topicSlug}:${lessonIndex}`;
  const query =
    LESSON_PHOTO_QUERIES[key] ??
    TOPIC_PHOTO_QUERIES[topicSlug] ??
    `${topicSlug} student technology project`;

  const pexels = await pexelsSearch(query, 3);
  if (pexels) return pexels;
  return fallbackPhoto(FALLBACK_TOPIC_PHOTOS[topicSlug] ?? FALLBACK_TOPIC_PHOTOS["coding-basics"]);
}

/**
 * Get real photo URLs for the three visual guide panels per lesson.
 * Returns [What You'll Build, How to Build It, Final Result].
 */
export async function getStepPhotos(
  topicSlug: string,
  lessonIndex: number,
): Promise<[PhotoResult, PhotoResult, PhotoResult]> {
  const key = `${topicSlug}:${lessonIndex}`;
  const baseQuery =
    LESSON_PHOTO_QUERIES[key] ??
    TOPIC_PHOTO_QUERIES[topicSlug] ??
    topicSlug;

  const fallback = FALLBACK_STEP_PHOTOS[topicSlug] ?? FALLBACK_STEP_PHOTOS["coding-basics"];

  const [r0, r1, r2] = await Promise.all([
    pexelsSearch(`${baseQuery} finished project result`, 3),
    pexelsSearch(`${baseQuery} building hands on step`, 3),
    pexelsSearch(`${baseQuery} completed working demonstration`, 3),
  ]);

  return [
    r0 ?? fallbackPhoto(fallback[0]),
    r1 ?? fallbackPhoto(fallback[1]),
    r2 ?? fallbackPhoto(fallback[2]),
  ];
}

/**
 * Get a real photo URL for a student note subject keyword.
 */
export async function getNotePhoto(subject: string): Promise<PhotoResult> {
  const pexels = await pexelsSearch(`${subject} students study education`, 3);
  if (pexels) return pexels;
  return fallbackPhoto("https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=900&q=80");
}
