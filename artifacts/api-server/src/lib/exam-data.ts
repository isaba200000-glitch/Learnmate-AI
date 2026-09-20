/**
 * Verified exam reference data.
 *
 * Every structural fact here (timings, question counts, scoring scales) was
 * cross-checked against the official test-maker's published material — the
 * `officialSite` on each entry — and against at least one independent prep
 * source, in September 2026. `lastVerified` records that date so stale rows
 * are easy to spot.
 *
 * IMPORTANT: several exams changed recently and a lot of material online is
 * out of date. Please keep these notes in mind when editing:
 *   • SAT is digital, adaptive and essay-free (since 2024).
 *   • ACT "enhanced" form (2025-26) made Science OPTIONAL and the composite is
 *     English + Math + Reading only.
 *   • GRE is the shorter 1h58m form; the Argument essay no longer exists.
 *   • GMAT dropped Sentence Correction/AWA; the scale is 205-805, not 200-800.
 *   • TOEFL iBT was overhauled on 21 Jan 2026: ~90 min, adaptive R&L, new task
 *     types, and a 1-6 CEFR band scale (0-120 shown only through 2028).
 *
 * This data is the *grounding* for the premium AI deep dive: the model is given
 * these facts and told not to contradict them, which stops it inventing a test
 * format that no longer exists.
 */

export interface ExamSection {
  name: string;
  questions?: string;
  minutes?: string;
  detail?: string;
}

export interface ExamTopic {
  area: string;
  weight?: string;
  items: string[];
}

export interface ExamTypeRecord {
  id: string;
  name: string;
  category: string;
  description: string;
  fullName?: string;
  format?: string;
  totalTime?: string;
  totalQuestions?: string;
  scoring?: string;
  sections?: ExamSection[];
  topics?: ExamTopic[];
  keyFacts?: string[];
  studyTips?: string[];
  validity?: string;
  officialSite?: string;
  lastVerified?: string;
}

const VERIFIED = "2026-09-20";

export const EXAM_TYPES: ExamTypeRecord[] = [
  {
    id: "sat",
    name: "SAT",
    fullName: "Scholastic Assessment Test (Digital SAT)",
    category: "College Admission (USA)",
    description: "Digital, section-adaptive admissions test for US colleges",
    format:
      "Fully digital in the Bluebook app, taken at a test centre or school. Section-adaptive: your performance on the first module of each section decides the difficulty of the second.",
    totalTime: "2 hours 14 minutes (plus a 10-minute break)",
    totalQuestions: "98",
    scoring:
      "400-1600 total (200-800 per section). No penalty for wrong answers, so never leave a question blank.",
    sections: [
      {
        name: "Reading and Writing",
        questions: "54",
        minutes: "2 modules x 32",
        detail:
          "Short passages of 25-150 words, each with a single question. Covers literature, history, social science and science.",
      },
      {
        name: "Math",
        questions: "44",
        minutes: "2 modules x 35",
        detail:
          "Multiple choice plus student-produced 'grid-in' answers. The built-in Desmos graphing calculator is available for every math question.",
      },
    ],
    topics: [
      {
        area: "Craft and Structure",
        weight: "28%",
        items: [
          "Words in context",
          "Text structure and purpose",
          "Cross-text connections",
        ],
      },
      {
        area: "Information and Ideas",
        weight: "26%",
        items: [
          "Central ideas and details",
          "Command of evidence (textual and quantitative)",
          "Inferences",
        ],
      },
      {
        area: "Standard English Conventions",
        weight: "26%",
        items: ["Sentence boundaries", "Subject-verb agreement", "Punctuation", "Verb tense and form"],
      },
      {
        area: "Expression of Ideas",
        weight: "20%",
        items: ["Rhetorical synthesis", "Transitions"],
      },
      {
        area: "Algebra",
        items: ["Linear equations and inequalities", "Systems of equations", "Linear functions"],
      },
      {
        area: "Advanced Math",
        items: ["Quadratics", "Polynomial and rational expressions", "Nonlinear functions", "Exponentials"],
      },
      {
        area: "Problem-Solving and Data Analysis",
        items: ["Ratios, rates and proportions", "Percentages", "Probability", "Interpreting graphs and tables", "Statistics"],
      },
      {
        area: "Geometry and Trigonometry",
        items: ["Area and volume", "Lines, angles and triangles", "Right triangles and trigonometry", "Circles"],
      },
    ],
    keyFacts: [
      "There is no essay on the digital SAT.",
      "Module 2 of each section adapts to how you did on Module 1, so early accuracy matters more than raw speed.",
      "Desmos graphing calculator is built in and allowed on the whole Math section.",
      "Wrong answers cost nothing - always guess rather than skip.",
    ],
    studyTips: [
      "Practise in Bluebook itself so the tools (flagging, annotation, Desmos) are second nature on test day.",
      "Because passages are short, drill 'one question per passage' timing rather than long-passage stamina.",
      "Log every wrong answer by domain (e.g. 'transitions') and review the pattern weekly rather than grinding random sets.",
    ],
    validity: "Scores are typically accepted for up to 5 years by most colleges.",
    officialSite: "https://satsuite.collegeboard.org/sat",
    lastVerified: VERIFIED,
  },
  {
    id: "act",
    name: "ACT",
    fullName: "American College Testing (enhanced ACT)",
    category: "College Admission (USA)",
    description: "US college admissions test with an optional Science section",
    format:
      "Available on paper and on computer. The enhanced format rolled out through 2025-26: shorter core, more time per question, and four answer choices in Math instead of five.",
    totalTime: "125 minutes for the core; 165 minutes with Science",
    totalQuestions: "131 core (171 with Science)",
    scoring:
      "Composite 1-36, the average of English, Math and Reading only. Science is reported separately and combines with Math for a STEM score.",
    sections: [
      { name: "English", questions: "50", minutes: "35", detail: "Grammar, usage, punctuation, rhetorical skills." },
      { name: "Math", questions: "45", minutes: "50", detail: "Four answer choices per question. Calculator permitted throughout." },
      { name: "Reading", questions: "36", minutes: "40", detail: "Prose fiction, social science, humanities and natural science. One passage is always argumentative." },
      { name: "Science (optional)", questions: "40", minutes: "40", detail: "Data representation, research summaries and conflicting viewpoints. Reported separately from the composite." },
      { name: "Writing (optional)", questions: "1 essay", minutes: "40", detail: "Analyse three perspectives on a contemporary issue." },
    ],
    topics: [
      {
        area: "English",
        items: ["Sentence structure and formation", "Punctuation", "Usage conventions", "Topic development", "Organisation and cohesion"],
      },
      {
        area: "Math",
        items: ["Number and quantity", "Algebra", "Functions", "Geometry", "Statistics and probability"],
      },
      {
        area: "Reading",
        items: ["Key ideas and details", "Craft and structure", "Integration of knowledge and ideas"],
      },
      {
        area: "Science",
        items: ["Interpretation of data", "Scientific investigation", "Evaluation of models and conflicting viewpoints"],
      },
    ],
    keyFacts: [
      "Science is now optional - check whether your target universities want it before skipping it.",
      "The composite score no longer includes Science.",
      "Math dropped from five answer choices to four, which improves the odds on a considered guess.",
      "The enhanced format gives roughly 18-22% more time per question than the classic ACT.",
    ],
    studyTips: [
      "Reading and Science reward pacing above all - practise with a visible clock and a fixed per-passage budget.",
      "In Science, read the question before the passage: most items are data lookup, not background knowledge.",
      "If a target university superscores, plan several sittings and focus each one on your weakest section.",
    ],
    validity: "Scores remain on file indefinitely; most universities accept results up to 5 years old.",
    officialSite: "https://www.act.org",
    lastVerified: VERIFIED,
  },
  {
    id: "gre",
    name: "GRE",
    fullName: "GRE General Test (shorter format)",
    category: "Graduate School",
    description: "Graduate admissions test covering verbal, quantitative and analytical writing",
    format:
      "Computer-delivered at a test centre or at home. Section-adaptive: the second Verbal and second Quant sections adjust to your performance on the first. There are no breaks and no unscored experimental section.",
    totalTime: "1 hour 58 minutes",
    totalQuestions: "54 questions plus 1 essay",
    scoring: "Verbal 130-170, Quantitative 130-170 (1-point steps), Analytical Writing 0-6 (half-point steps).",
    sections: [
      { name: "Analytical Writing", questions: "1 task", minutes: "30", detail: "A single 'Analyze an Issue' essay. The Argument essay was removed." },
      { name: "Verbal Reasoning", questions: "27 (12 + 15)", minutes: "41 (18 + 23)", detail: "Reading comprehension, text completion and sentence equivalence." },
      { name: "Quantitative Reasoning", questions: "27 (12 + 15)", minutes: "47 (21 + 26)", detail: "Quantitative comparison, problem solving and data interpretation. On-screen calculator provided." },
    ],
    topics: [
      {
        area: "Verbal Reasoning",
        items: ["Reading comprehension", "Text completion", "Sentence equivalence", "Academic vocabulary in context"],
      },
      {
        area: "Quantitative Reasoning",
        items: ["Arithmetic and number properties", "Algebra", "Geometry", "Data analysis, statistics and probability"],
      },
      {
        area: "Analytical Writing",
        items: ["Constructing a position", "Supporting claims with evidence", "Logical organisation", "Standard written English"],
      },
    ],
    keyFacts: [
      "The test is section-adaptive, not question-adaptive - you can move freely within a section and change answers.",
      "There is only one essay now; older prep books that drill the Argument task are out of date.",
      "An on-screen calculator is provided for Quant only.",
      "You may take the GRE once every 21 days, up to 5 times in any rolling 12 months.",
    ],
    studyTips: [
      "Because the first section sets your adaptive path, spend your sharpest attention there.",
      "Build vocabulary in context with real sentences rather than isolated word lists.",
      "Practise the Issue essay to a strict 30-minute clock - structure earns more than length.",
    ],
    validity: "Scores are valid for 5 years from the test date.",
    officialSite: "https://www.ets.org/gre",
    lastVerified: VERIFIED,
  },
  {
    id: "gmat",
    name: "GMAT",
    fullName: "Graduate Management Admission Test",
    category: "Business School",
    description: "Business school admissions test focused on reasoning and data literacy",
    format:
      "Computer-adaptive, three equally weighted sections you may take in any of six orders. One optional 10-minute break. You can bookmark questions and change up to three answers per section.",
    totalTime: "2 hours 15 minutes (3 x 45 minutes)",
    totalQuestions: "64",
    scoring: "Total 205-805 in 10-point increments (always ending in 5). Each section is scored 60-90.",
    sections: [
      { name: "Quantitative Reasoning", questions: "21", minutes: "45", detail: "Problem solving only. No geometry and no data sufficiency." },
      { name: "Verbal Reasoning", questions: "23", minutes: "45", detail: "Reading comprehension and critical reasoning. Sentence Correction was removed." },
      { name: "Data Insights", questions: "20", minutes: "45", detail: "Data sufficiency, multi-source reasoning, table analysis, graphics interpretation and two-part analysis." },
    ],
    topics: [
      {
        area: "Quantitative Reasoning",
        items: ["Arithmetic and number properties", "Algebra", "Word problems", "Rates, ratios and percentages"],
      },
      {
        area: "Verbal Reasoning",
        items: ["Reading comprehension", "Critical reasoning: assumptions", "Strengthen and weaken arguments", "Evaluate and inference"],
      },
      {
        area: "Data Insights",
        items: ["Data sufficiency", "Multi-source reasoning", "Table analysis", "Graphics interpretation", "Two-part analysis"],
      },
    ],
    keyFacts: [
      "There is no essay (AWA) on the current GMAT.",
      "Sentence Correction and most pure geometry were removed.",
      "Data Insights counts as much as Quant and Verbal - it is the section most candidates under-prepare.",
      "Limits: 5 attempts in 12 months and 8 in a lifetime.",
    ],
    studyTips: [
      "Treat Data Insights as a third full subject, not an afterthought; it is a third of your score.",
      "Use the bookmark-and-review feature deliberately: bank easy marks first, then spend the remainder.",
      "Drill critical reasoning by naming the logical flaw in your own words before reading the options.",
    ],
    validity: "Scores are valid for 5 years.",
    officialSite: "https://www.mba.com/exams/gmat-exam",
    lastVerified: VERIFIED,
  },
  {
    id: "ielts",
    name: "IELTS",
    fullName: "International English Language Testing System",
    category: "English Proficiency",
    description: "English proficiency test for study, work and migration",
    format:
      "Available on paper or computer, in Academic and General Training versions. Listening, Reading and Writing are taken in one sitting; Speaking is a face-to-face interview with an examiner, up to a week either side.",
    totalTime: "About 2 hours 45 minutes",
    totalQuestions: "80 questions across Listening and Reading, plus 2 writing tasks and a spoken interview",
    scoring:
      "Band 0-9 for each skill; the overall band is the average of the four, rounded to the nearest half band. There is no pass or fail and no negative marking.",
    sections: [
      { name: "Listening", questions: "40", minutes: "30", detail: "Four recordings, from everyday conversation to an academic lecture. Paper takers get 10 extra minutes to transfer answers." },
      { name: "Reading", questions: "40", minutes: "60", detail: "Academic: three long texts. General Training: three sections of workplace and everyday material." },
      { name: "Writing", questions: "2 tasks", minutes: "60", detail: "Academic Task 1 describes a graph or process (150+ words); General Task 1 is a letter. Task 2 is a 250+ word essay and carries twice the weight." },
      { name: "Speaking", questions: "3 parts", minutes: "11-14", detail: "Introduction and interview, a long turn from a cue card, then a two-way discussion." },
    ],
    topics: [
      {
        area: "Listening skills",
        items: ["Form and note completion", "Multiple choice", "Matching and labelling maps or plans", "Following a spoken argument"],
      },
      {
        area: "Reading skills",
        items: ["Skimming and scanning", "True/False/Not Given", "Matching headings", "Summary completion"],
      },
      {
        area: "Writing skills",
        items: ["Describing data and trends", "Formal and informal letters", "Essay structure and cohesion", "Range and accuracy of grammar"],
      },
      {
        area: "Speaking skills",
        items: ["Fluency and coherence", "Lexical resource", "Grammatical range and accuracy", "Pronunciation"],
      },
    ],
    keyFacts: [
      "Task 2 is worth twice as much as Task 1 - budget about 40 of your 60 writing minutes for it.",
      "There is no negative marking, so answer every question.",
      "'Not Given' means the text simply does not say - it is not the same as 'False'.",
      "One Skill Retake lets you resit a single skill instead of the whole test (computer-delivered).",
    ],
    studyTips: [
      "Most universities ask for 6.5 overall with no band below 6.0 - check the per-band minimum, not just the average.",
      "Record yourself answering Part 2 cue cards for two minutes; fluency improves fastest with playback.",
      "In Reading, practise locating the answer rather than understanding every word - the clock is the real examiner.",
    ],
    validity: "Scores are valid for 2 years.",
    officialSite: "https://ielts.org",
    lastVerified: VERIFIED,
  },
  {
    id: "toefl",
    name: "TOEFL iBT",
    fullName: "Test of English as a Foreign Language (internet-based test)",
    category: "English Proficiency",
    description: "Academic English test, redesigned in January 2026 as a shorter adaptive exam",
    format:
      "Computer-delivered at a test centre or at home. Since 21 January 2026 the Reading and Listening sections are multi-stage adaptive; Speaking and Writing are linear. There are no scheduled breaks and no note-taking in Listening.",
    totalTime: "About 90 minutes",
    totalQuestions: "120 items across the four sections (includes unscored trial items)",
    scoring:
      "Each section is scored 1.0-6.0 in half bands, aligned to CEFR; the overall score is the average of the four, rounded to the nearest half band. A comparable 0-120 score is also shown during the 2026-2028 transition.",
    sections: [
      { name: "Reading", questions: "50", minutes: "~30", detail: "Complete the Words, Read in Daily Life, and Read an Academic Passage." },
      { name: "Listening", questions: "47", minutes: "~29", detail: "Listen and Choose a Response, a conversation, an announcement and an academic talk." },
      { name: "Writing", questions: "12", minutes: "~23", detail: "Build a Sentence, Write an Email, and Write for an Academic Discussion." },
      { name: "Speaking", questions: "11", minutes: "~8", detail: "Listen and Repeat, plus an interview-style task." },
    ],
    topics: [
      {
        area: "Reading",
        items: ["Vocabulary in context", "Everyday and campus texts", "Academic passage comprehension", "Inference and detail"],
      },
      {
        area: "Listening",
        items: ["Conversational response selection", "Campus announcements", "Academic lectures", "Speaker attitude and purpose"],
      },
      {
        area: "Writing",
        items: ["Sentence construction", "Email register and tone", "Contributing to an academic discussion", "Grammar and mechanics"],
      },
      {
        area: "Speaking",
        items: ["Pronunciation and repetition accuracy", "Spontaneous interview responses", "Fluency", "Clarity of ideas"],
      },
    ],
    keyFacts: [
      "Most TOEFL material online still describes the pre-2026 test - ignore guides mentioning four reading passages, six speaking tasks or the independent essay.",
      "Integrated read-listen-speak tasks and the academic essay no longer exist.",
      "Scores arrive within about 72 hours (3 days).",
      "Band 5 in a section indicates C1 proficiency for that skill.",
    ],
    studyTips: [
      "Because Reading and Listening adapt, accuracy early in a section shapes the difficulty - and the score - that follows.",
      "Practise the new short task types (Complete the Words, Build a Sentence, Listen and Repeat) specifically; they reward automaticity, not essay skill.",
      "Listening allows no note-taking now, so train active recall of the main point rather than transcription.",
    ],
    validity: "Scores are valid for 2 years.",
    officialSite: "https://www.ets.org/toefl",
    lastVerified: VERIFIED,
  },
  {
    id: "gcse",
    name: "GCSE",
    fullName: "General Certificate of Secondary Education",
    category: "UK Secondary",
    description: "UK subject-by-subject qualifications, usually taken at age 16",
    format:
      "Separate exams per subject, set by boards such as AQA, Edexcel, OCR and WJEC. Mostly terminal written papers in May and June, with non-exam assessment in subjects like art, drama and the sciences' practical endorsement.",
    totalTime: "Varies by subject - typically two or three papers of 1 to 2 hours each",
    scoring:
      "Graded 9 to 1 in England (9 highest). A grade 4 is a standard pass and a grade 5 a strong pass. Wales and Northern Ireland use A*-G variants.",
    sections: [
      { name: "English Language", detail: "Two papers covering reading comprehension and writing, plus a separate spoken language endorsement." },
      { name: "Mathematics", detail: "Three papers at Foundation (grades 1-5) or Higher (grades 4-9) tier; one non-calculator." },
      { name: "Sciences", detail: "Combined Science (double award) or three separate GCSEs, with required practical activities assessed in the written papers." },
    ],
    topics: [
      {
        area: "Mathematics",
        items: ["Number", "Algebra", "Ratio, proportion and rates of change", "Geometry and measures", "Probability", "Statistics"],
      },
      {
        area: "English Language",
        items: ["Reading unseen fiction and non-fiction", "Language and structure analysis", "Descriptive and narrative writing", "Writing to present a viewpoint"],
      },
      {
        area: "Combined Science",
        items: ["Cell biology and organisation", "Infection and response", "Bioenergetics", "Atomic structure and the periodic table", "Chemical changes", "Energy and electricity", "Forces and waves"],
      },
    ],
    keyFacts: [
      "Grade 4 is a standard pass; many sixth forms ask for grade 5 or above in English and Maths.",
      "Maths and the sciences are tiered - the Foundation tier caps the achievable grade, so tier choice matters.",
      "Exam boards publish the specification and past papers free; always check which board your school uses.",
    ],
    studyTips: [
      "Work from your board's specification checklist - content differs between AQA, Edexcel and OCR.",
      "Past papers with the official mark scheme are the highest-value revision resource; mark your own work against it.",
      "Learn the required practicals by name: they are guaranteed to appear in the science papers.",
    ],
    officialSite: "https://www.gov.uk/what-different-qualification-levels-mean",
    lastVerified: VERIFIED,
  },
  {
    id: "a-level",
    name: "A-Level",
    fullName: "General Certificate of Education, Advanced Level",
    category: "UK Advanced",
    description: "UK pre-university qualifications, usually three subjects over two years",
    format:
      "Linear: nearly all assessment happens in final exams at the end of the two-year course. Some subjects add coursework or a practical endorsement.",
    totalTime: "Varies by subject - commonly two or three papers of 1.5 to 2.5 hours",
    scoring: "Graded A* to E. University offers are quoted as grade combinations such as AAB.",
    sections: [
      { name: "Year 12 (AS content)", detail: "Foundational content; may be examined as a standalone AS qualification." },
      { name: "Year 13 (A2 content)", detail: "Advanced content, with synoptic papers drawing on the whole course." },
    ],
    topics: [
      {
        area: "Mathematics",
        items: ["Proof", "Algebra and functions", "Coordinate geometry", "Sequences and series", "Trigonometry", "Differentiation and integration", "Vectors", "Statistics and mechanics"],
      },
      {
        area: "Biology",
        items: ["Biological molecules", "Cells", "Exchange and transport", "Genetics and variation", "Energy transfer", "Homeostasis and response"],
      },
      {
        area: "Chemistry",
        items: ["Physical chemistry", "Inorganic chemistry", "Organic chemistry", "Practical skills and analysis"],
      },
      {
        area: "Physics",
        items: ["Mechanics and materials", "Electricity", "Waves and optics", "Nuclear and particle physics", "Fields"],
      },
    ],
    keyFacts: [
      "Assessment is linear - almost everything rests on the final exams.",
      "Synoptic papers deliberately mix topics from both years.",
      "UCAS offers depend on specific grades in specific subjects, so check each course's requirements early.",
    ],
    studyTips: [
      "Build a topic-by-topic confidence tracker from the specification and revisit red topics on a spaced schedule.",
      "Practise full papers under timed conditions from the start of Year 13, not just in the final weeks.",
      "Learn examiner command words ('evaluate', 'justify', 'compare') - marks follow the command, not the content dump.",
    ],
    officialSite: "https://www.gov.uk/what-different-qualification-levels-mean",
    lastVerified: VERIFIED,
  },
  {
    id: "ib",
    name: "IB Diploma",
    fullName: "International Baccalaureate Diploma Programme",
    category: "International",
    description: "Two-year international pre-university diploma with a core of three components",
    format:
      "Six subjects, one from each of six groups, taken at Higher Level (HL) or Standard Level (SL) - normally three HL and three SL - plus the three core components.",
    totalTime: "Two years of coursework and final examinations",
    scoring:
      "Each subject is graded 1-7, giving 42 points, plus up to 3 bonus points from Theory of Knowledge and the Extended Essay. Maximum 45; 24 points is the minimum pass with conditions.",
    sections: [
      { name: "Studies in Language and Literature", detail: "Group 1 - your strongest language." },
      { name: "Language Acquisition", detail: "Group 2 - a second language." },
      { name: "Individuals and Societies", detail: "Group 3 - history, economics, psychology and similar." },
      { name: "Sciences", detail: "Group 4 - biology, chemistry, physics, computer science." },
      { name: "Mathematics", detail: "Group 5 - Analysis and Approaches, or Applications and Interpretation." },
      { name: "The Arts or an elective", detail: "Group 6 - or a second subject from groups 1-5." },
    ],
    topics: [
      {
        area: "The IB core",
        items: [
          "Theory of Knowledge (TOK): a 1,600-word essay and an exhibition",
          "Extended Essay: a 4,000-word independent research paper",
          "Creativity, Activity, Service (CAS): a portfolio of experiences",
        ],
      },
      {
        area: "Assessment types",
        items: ["Final written examinations", "Internal assessment marked by teachers and moderated by the IB", "Oral assessments in languages"],
      },
    ],
    keyFacts: [
      "TOK and the Extended Essay together contribute up to 3 bonus points and can decide a borderline diploma.",
      "Internal assessment counts towards the final grade in every subject - it is not practice work.",
      "Failing conditions include an HL grade of 1 or too many 2s, even with 24+ total points.",
    ],
    studyTips: [
      "Start the Extended Essay early; the research question is the single biggest predictor of the final grade.",
      "Treat internal assessment deadlines as exam dates - they are worth 20-30% in most subjects.",
      "Use the subject guide's assessment criteria verbatim when self-marking your drafts.",
    ],
    officialSite: "https://www.ibo.org/programmes/diploma-programme/",
    lastVerified: VERIFIED,
  },
  {
    id: "waec",
    name: "WAEC",
    fullName: "West African Senior School Certificate Examination",
    category: "West Africa",
    description: "School-leaving certificate across Nigeria, Ghana, Sierra Leone, Liberia and The Gambia",
    format:
      "Subject papers usually combining objective (multiple choice), theory/essay and, where relevant, practical components. Candidates normally sit 8-9 subjects.",
    totalTime: "Varies by subject - commonly 2 to 3 hours per subject across multiple papers",
    scoring: "Graded A1 to F9. A1-C6 is a credit pass; most universities require credits in at least five subjects including English and Mathematics.",
    sections: [
      { name: "Paper 1", detail: "Objective multiple-choice questions." },
      { name: "Paper 2", detail: "Theory or essay questions." },
      { name: "Paper 3", detail: "Practical or oral, in science, technical and language subjects." },
    ],
    topics: [
      {
        area: "English Language",
        items: ["Comprehension and summary", "Lexis and structure", "Oral English", "Essay writing"],
      },
      {
        area: "Mathematics",
        items: ["Number and numeration", "Algebraic processes", "Geometry and trigonometry", "Statistics and probability"],
      },
      {
        area: "Sciences",
        items: ["Biology: cells, ecology, genetics", "Chemistry: atomic structure, reactions, organic chemistry", "Physics: mechanics, waves, electricity"],
      },
    ],
    keyFacts: [
      "Five credits including English and Mathematics is the standard university entry requirement.",
      "Practical papers carry real weight in the sciences - laboratory familiarity matters.",
      "WAEC publishes a syllabus and past questions; the syllabus is the definitive scope.",
    ],
    studyTips: [
      "Work through past questions by topic, then by full paper under timed conditions.",
      "In theory papers, structure answers with clear headings - examiners mark to a points scheme.",
      "Do not neglect Oral English; it is often the difference between a C and a B overall.",
    ],
    officialSite: "https://www.waecdirect.org",
    lastVerified: VERIFIED,
  },
  {
    id: "jamb",
    name: "JAMB UTME",
    fullName: "Joint Admissions and Matriculation Board Unified Tertiary Matriculation Examination",
    category: "Nigeria",
    description: "Computer-based entrance examination for Nigerian universities and polytechnics",
    format:
      "Computer-based test. Four subjects: compulsory Use of English plus three chosen to match your intended course.",
    totalTime: "2 hours",
    totalQuestions: "180 (Use of English 60, other three subjects 40 each)",
    scoring: "400 total (Use of English 60 questions scaled, each other subject 100). Cut-off marks vary by institution and course.",
    sections: [
      { name: "Use of English", questions: "60", detail: "Compulsory for every candidate: comprehension, lexis, structure and oral forms." },
      { name: "Subject 2", questions: "40", detail: "Chosen to match the course requirements." },
      { name: "Subject 3", questions: "40", detail: "Chosen to match the course requirements." },
      { name: "Subject 4", questions: "40", detail: "Chosen to match the course requirements." },
    ],
    topics: [
      {
        area: "Use of English",
        items: ["Comprehension passages", "Synonyms and antonyms", "Sentence interpretation", "Grammatical structure"],
      },
      {
        area: "Common science combinations",
        items: ["Physics, Chemistry, Biology for medicine and related courses", "Physics, Chemistry, Mathematics for engineering"],
      },
      {
        area: "Common arts and commercial combinations",
        items: ["Government, Literature, CRS/IRS for law and the humanities", "Economics, Accounting, Commerce for business courses"],
      },
    ],
    keyFacts: [
      "Subject combination must match your intended course - the wrong combination invalidates the application.",
      "The whole exam is 2 hours for 180 questions: about 40 seconds per question.",
      "Answer everything; there is no negative marking.",
    ],
    studyTips: [
      "Practise on a computer, not on paper - screen navigation costs real time on test day.",
      "Read the JAMB recommended-texts list: literature questions come directly from it.",
      "Drill the 40-seconds-per-question rhythm so that no single item eats your time budget.",
    ],
    officialSite: "https://www.jamb.gov.ng",
    lastVerified: VERIFIED,
  },
  {
    id: "neet",
    name: "NEET UG",
    fullName: "National Eligibility cum Entrance Test (Undergraduate)",
    category: "India Medical",
    description: "Single entrance examination for undergraduate medical and dental courses in India",
    format: "Pen-and-paper (OMR) test conducted by the National Testing Agency, held once a year in multiple languages.",
    totalTime: "3 hours 20 minutes",
    totalQuestions: "180 to be answered",
    scoring:
      "720 marks maximum. Four marks for each correct answer and minus one for each wrong answer, so accuracy beats coverage.",
    sections: [
      { name: "Physics", questions: "45", detail: "180 marks." },
      { name: "Chemistry", questions: "45", detail: "180 marks." },
      { name: "Biology (Botany and Zoology)", questions: "90", detail: "360 marks - half the paper." },
    ],
    topics: [
      {
        area: "Physics",
        items: ["Mechanics", "Thermodynamics", "Electrodynamics", "Optics", "Modern physics"],
      },
      {
        area: "Chemistry",
        items: ["Physical chemistry", "Inorganic chemistry", "Organic chemistry"],
      },
      {
        area: "Biology",
        items: ["Diversity of living organisms", "Cell structure and function", "Plant and human physiology", "Genetics and evolution", "Ecology and environment", "Biotechnology"],
      },
    ],
    keyFacts: [
      "Biology is half the total marks - it is where ranks are won.",
      "Negative marking means a wild guess has negative expected value.",
      "The syllabus follows NCERT Classes 11 and 12 closely.",
    ],
    studyTips: [
      "Master the NCERT biology textbook line by line; a large share of questions map directly onto it.",
      "Track accuracy, not just attempts, in mock tests - the penalty makes reckless attempts costly.",
      "Revise physics formulas with derivations so you can rebuild anything you blank on.",
    ],
    officialSite: "https://neet.nta.nic.in",
    lastVerified: VERIFIED,
  },
  {
    id: "upsc",
    name: "UPSC CSE",
    fullName: "Union Public Service Commission Civil Services Examination",
    category: "India Civil Service",
    description: "Three-stage selection for the Indian Administrative, Police and Foreign Services",
    format:
      "Stage 1 Preliminary (objective, qualifying only), Stage 2 Main (nine descriptive papers), Stage 3 Personality Test (interview). The whole cycle runs about a year.",
    totalTime: "Preliminary: two 2-hour papers. Main: nine papers of 3 hours each.",
    scoring:
      "The final merit list uses the Main written papers (1,750 marks) plus the Personality Test (275 marks). Preliminary marks do not count towards the final rank.",
    sections: [
      { name: "Prelims Paper I - General Studies", questions: "100", minutes: "120", detail: "200 marks. This paper decides who qualifies." },
      { name: "Prelims Paper II - CSAT", questions: "80", minutes: "120", detail: "Qualifying only: you need 33%." },
      { name: "Mains - Essay", detail: "250 marks." },
      { name: "Mains - General Studies I-IV", detail: "250 marks each, covering heritage and society, governance and international relations, economy and technology, and ethics." },
      { name: "Mains - Optional subject", detail: "Two papers of 250 marks in a subject you choose." },
      { name: "Personality Test", detail: "275 marks." },
    ],
    topics: [
      {
        area: "General Studies I",
        items: ["Indian heritage and culture", "Modern Indian history", "World history", "Indian society", "Geography"],
      },
      {
        area: "General Studies II",
        items: ["Constitution and polity", "Governance", "Social justice", "International relations"],
      },
      {
        area: "General Studies III",
        items: ["Indian economy", "Agriculture", "Science and technology", "Environment", "Internal security", "Disaster management"],
      },
      {
        area: "General Studies IV",
        items: ["Ethics and human interface", "Attitude and aptitude", "Emotional intelligence", "Probity in governance", "Case studies"],
      },
    ],
    keyFacts: [
      "Preliminary marks are purely a filter - they do not carry into the final ranking.",
      "CSAT only needs 33%, but failing it ends your attempt regardless of Paper I.",
      "Current affairs cut across every stage; a daily newspaper habit is effectively part of the syllabus.",
    ],
    studyTips: [
      "Choose the optional subject on genuine interest and material availability - it is 500 marks.",
      "Write full-length answers to a timer from early on; Mains is an endurance writing test.",
      "Maintain one consolidated current-affairs note per month rather than many scattered sources.",
    ],
    officialSite: "https://upsc.gov.in",
    lastVerified: VERIFIED,
  },
  {
    id: "university",
    name: "University Exams",
    category: "Higher Education",
    description: "General semester and end-of-year university examinations",
    format:
      "Set by your own department: a mix of written exams, open-book papers, coursework, laboratory reports, presentations and vivas.",
    totalTime: "Typically 2 to 3 hours per written paper",
    scoring: "Institution-specific - percentage marks, GPA points or degree classifications.",
    topics: [
      {
        area: "Universal exam skills",
        items: [
          "Reading the module learning outcomes as your revision checklist",
          "Practising with past papers from your own department",
          "Answering the command word: analyse, evaluate, compare, justify",
          "Managing time across questions by their mark allocation",
        ],
      },
      {
        area: "Effective study techniques",
        items: [
          "Spaced repetition instead of massed cramming",
          "Retrieval practice: close the book and reproduce from memory",
          "Interleaving related topics rather than blocking one at a time",
          "Explaining a concept aloud as if teaching it",
        ],
      },
    ],
    keyFacts: [
      "The module handbook's learning outcomes are the real syllabus - exams are written against them.",
      "Mark allocation tells you how long to spend and how much depth is expected.",
      "Most departments release past papers; your own lecturer's style is the best predictor of the paper.",
    ],
    studyTips: [
      "Convert each learning outcome into a question and answer it from memory - that is retrieval practice.",
      "Spread revision across weeks: the spacing effect is the best-evidenced study finding there is.",
      "Do a full timed past paper at least once before the real thing.",
    ],
    lastVerified: VERIFIED,
  },
];

export function findExam(examId: string): ExamTypeRecord | undefined {
  const needle = examId.trim().toLowerCase();
  return EXAM_TYPES.find((e) => e.id === needle);
}

/**
 * Compact, factual briefing used to ground the premium AI deep dive so it
 * cannot hallucinate an outdated test format.
 */
export function buildExamFactSheet(exam: ExamTypeRecord): string {
  const lines: string[] = [`Exam: ${exam.name}${exam.fullName ? ` (${exam.fullName})` : ""}`];
  lines.push(`Category: ${exam.category}`);
  if (exam.format) lines.push(`Format: ${exam.format}`);
  if (exam.totalTime) lines.push(`Total time: ${exam.totalTime}`);
  if (exam.totalQuestions) lines.push(`Total questions: ${exam.totalQuestions}`);
  if (exam.scoring) lines.push(`Scoring: ${exam.scoring}`);
  if (exam.validity) lines.push(`Score validity: ${exam.validity}`);
  if (exam.sections?.length) {
    lines.push("Sections:");
    for (const s of exam.sections) {
      const bits = [s.questions ? `${s.questions} questions` : null, s.minutes ? `${s.minutes} minutes` : null]
        .filter(Boolean)
        .join(", ");
      lines.push(`- ${s.name}${bits ? ` (${bits})` : ""}${s.detail ? `: ${s.detail}` : ""}`);
    }
  }
  if (exam.topics?.length) {
    lines.push("Syllabus areas:");
    for (const t of exam.topics) {
      lines.push(`- ${t.area}${t.weight ? ` [${t.weight}]` : ""}: ${t.items.join("; ")}`);
    }
  }
  if (exam.keyFacts?.length) {
    lines.push("Verified key facts:");
    for (const f of exam.keyFacts) lines.push(`- ${f}`);
  }
  if (exam.officialSite) lines.push(`Official source: ${exam.officialSite}`);
  if (exam.lastVerified) lines.push(`Facts verified on: ${exam.lastVerified}`);
  return lines.join("\n");
}
