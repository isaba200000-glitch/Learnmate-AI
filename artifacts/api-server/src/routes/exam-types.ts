import { Router, type IRouter } from "express";

const router: IRouter = Router();

const EXAM_TYPES = [
  { id: "sat", name: "SAT", category: "College Admission (USA)", description: "Scholastic Assessment Test for US college admissions" },
  { id: "act", name: "ACT", category: "College Admission (USA)", description: "American College Testing for US college admissions" },
  { id: "gre", name: "GRE", category: "Graduate School", description: "Graduate Record Examination for graduate school admissions" },
  { id: "gmat", name: "GMAT", category: "Business School", description: "Graduate Management Admission Test for MBA programs" },
  { id: "ielts", name: "IELTS", category: "English Proficiency", description: "International English Language Testing System" },
  { id: "toefl", name: "TOEFL", category: "English Proficiency", description: "Test of English as a Foreign Language" },
  { id: "gcse", name: "GCSE", category: "UK Secondary", description: "General Certificate of Secondary Education (UK)" },
  { id: "a-level", name: "A-Level", category: "UK Advanced", description: "Advanced Level qualifications (UK)" },
  { id: "ib", name: "IB", category: "International", description: "International Baccalaureate Diploma Programme" },
  { id: "waec", name: "WAEC", category: "West Africa", description: "West African Examinations Council" },
  { id: "jamb", name: "JAMB", category: "Nigeria", description: "Joint Admissions and Matriculation Board (Nigeria)" },
  { id: "neet", name: "NEET", category: "India Medical", description: "National Eligibility cum Entrance Test (India)" },
  { id: "upsc", name: "UPSC", category: "India Civil Service", description: "Union Public Service Commission (India)" },
  { id: "university", name: "University Exams", category: "Higher Education", description: "General university-level examinations" },
];

router.get("/exam-types", async (_req, res): Promise<void> => {
  res.json(EXAM_TYPES);
});

export default router;
