import type { JobMatchAnalysis } from "@/types/jobMatch";
import { callClaude, extractJson } from "./callClaude";

const SYSTEM_PROMPT = `You are an expert technical recruiter and career coach. Analyze how well a candidate's resume matches a job description and return a structured JSON analysis. You must ONLY return valid JSON — no markdown, no commentary outside the JSON.`;

function buildUserPrompt(resumeText: string, jobDescription: string): string {
  return `Compare the resume below against the job description and return a JSON object matching this exact schema.

RESUME:
---
${resumeText.slice(0, 6000)}
---

JOB DESCRIPTION:
---
${jobDescription.slice(0, 4000)}
---

Return ONLY this JSON structure:
{
  "jobTitle": "<job title extracted from the job description>",
  "company": "<company name extracted from the job description>",
  "matchScore": <number 0-100, overall fit score>,
  "summary": "<2-3 sentences: how well the candidate fits, top strength, biggest gap>",
  "strengths": ["<specific resume element that matches job requirement>", ...],
  "gaps": ["<specific missing skill, experience, or qualification>", ...],
  "suggestions": [
    { "area": "<skill or section>", "improvement": "<concrete, ready-to-use resume change to improve this match>" }
  ],
  "keywordMatch": {
    "matched": ["<keyword found in both resume and JD>", ...],
    "missing": ["<important JD keyword absent from resume>", ...]
  }
}

Rules:
- matchScore: 0–100. 80+ = strong match, 60–79 = moderate, below 60 = significant gaps
- strengths: 3–5 items, each referencing specific resume content
- gaps: 3–5 items, each referencing specific JD requirements
- suggestions: 3–4 concrete rewrites or additions (not generic advice)
- keywordMatch.matched: 5–10 keywords
- keywordMatch.missing: 5–10 keywords`;
}

export async function analyzeJobMatch(
  resumeText: string,
  jobDescription: string,
): Promise<JobMatchAnalysis> {
  const raw = await callClaude(SYSTEM_PROMPT, buildUserPrompt(resumeText, jobDescription), 2000);
  return JSON.parse(extractJson(raw)) as JobMatchAnalysis;
}
