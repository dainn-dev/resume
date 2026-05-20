import type { ResumeAnalysis } from "@/types/resume";
import { callClaude, extractJson } from "./callClaude";

const SYSTEM_PROMPT = `You are an expert resume coach and hiring manager with 15+ years of experience reviewing resumes across tech, finance, and business sectors. Your role is to evaluate a resume objectively and return a structured JSON analysis. You must ONLY return valid JSON — no markdown, no commentary outside the JSON.`;

function buildUserPrompt(resumeText: string): string {
  const truncated = resumeText.slice(0, 8000);
  return `Analyze the following resume and return a JSON object that exactly matches this schema. Score each section from 0–100 based on completeness, clarity, impact, and industry best practices.

RESUME TEXT:
---
${truncated}
---

Return ONLY this JSON structure with no additional text:
{
  "overallScore": <number 0-100>,
  "overallSummary": "<2-3 sentence executive summary of the resume's strengths and main weaknesses>",
  "sections": {
    "contactInfo": {
      "score": <number 0-100>,
      "label": "Contact Information",
      "tips": [{ "problem": "<what is wrong or missing>", "suggestion": "<exact rewritten text or concrete example to achieve 100>" }]
    },
    "summary": {
      "score": <number 0-100>,
      "label": "Summary / Objective",
      "tips": [{ "problem": "<what is wrong or missing>", "suggestion": "<exact rewritten text or concrete example to achieve 100>" }]
    },
    "workExperience": {
      "score": <number 0-100>,
      "label": "Work Experience",
      "tips": [{ "problem": "<what is wrong or missing>", "suggestion": "<exact rewritten text or concrete example to achieve 100>" }]
    },
    "education": {
      "score": <number 0-100>,
      "label": "Education",
      "tips": [{ "problem": "<what is wrong or missing>", "suggestion": "<exact rewritten text or concrete example to achieve 100>" }]
    },
    "skills": {
      "score": <number 0-100>,
      "label": "Skills",
      "tips": [{ "problem": "<what is wrong or missing>", "suggestion": "<exact rewritten text or concrete example to achieve 100>" }]
    },
    "formatting": {
      "score": <number 0-100>,
      "label": "Formatting & Readability",
      "tips": [{ "problem": "<what is wrong or missing>", "suggestion": "<exact rewritten text or concrete example to achieve 100>" }]
    }
  }
}

Rules:
- Each section must have 2–4 tips
- "problem" must be specific and reference actual content from the resume
- "suggestion" must be a concrete, ready-to-use rewrite or example — not generic advice. Show exactly what the candidate should write to score 100.
- If a section is missing entirely, score it 0 and provide a full example of what to add`;
}

export async function analyzeResume(resumeText: string): Promise<ResumeAnalysis> {
  const raw = await callClaude(SYSTEM_PROMPT, buildUserPrompt(resumeText));
  return JSON.parse(extractJson(raw)) as ResumeAnalysis;
}
