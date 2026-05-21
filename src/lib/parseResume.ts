import type { ResumeFormData } from "@/types/builder";
import { callClaude, extractJson } from "./callClaude";

const SYSTEM_PROMPT = `You are an expert resume parser. Extract the candidate's information from the resume text and return a JSON object matching the exact schema provided. Return ONLY valid JSON — no markdown fences, no commentary outside the JSON.`;

// Upper bound on resume text we send to the model. Larger than the prior
// 8000-char cap so multi-page resumes (often 18k+ chars) don't silently lose
// their later work entries, education, and certifications.
const MAX_RESUME_CHARS = 24000;

function buildUserPrompt(resumeText: string): string {
  const truncated = resumeText.slice(0, MAX_RESUME_CHARS);
  return `Parse the following resume and extract all information into this exact JSON schema. Use empty strings for missing fields, empty arrays for missing lists.

RESUME TEXT:
---
${truncated}
---

Return ONLY this JSON:
{
  "fullName": "<candidate full name>",
  "email": "<email address>",
  "phone": "<phone number>",
  "location": "<city, state or country>",
  "linkedIn": "<LinkedIn URL if present, else empty string>",
  "github": "<GitHub URL if present, else empty string>",
  "summary": "<professional summary or objective if present, else empty string>",
  "workEntries": [
    {
      "company": "<company name>",
      "projectName": "<project name if mentioned, else empty string>",
      "title": "<job title>",
      "startDate": "<start month/year e.g. Jan 2022>",
      "endDate": "<end month/year or Present>",
      "bullets": ["<achievement or responsibility 1>", "<achievement or responsibility 2>"]
    }
  ],
  "educationEntries": [
    {
      "school": "<school name>",
      "degree": "<degree and field e.g. B.S. Computer Science>",
      "graduationYear": "<year>",
      "gpa": "<GPA if listed, else empty string>"
    }
  ],
  "technicalSkills": "<comma-separated technical skills>",
  "softSkills": "<comma-separated soft skills if listed>",
  "certifications": "<certifications if listed>",
  "languages": "<spoken languages if listed>",
  "projects": "<notable projects if listed, else empty string>"
}`;
}

export async function parseResume(resumeText: string): Promise<ResumeFormData> {
  const raw = await callClaude(SYSTEM_PROMPT, buildUserPrompt(resumeText), 8000);
  return JSON.parse(extractJson(raw)) as ResumeFormData;
}
