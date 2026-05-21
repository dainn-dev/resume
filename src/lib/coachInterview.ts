import { callClaude, extractJson } from "./callClaude";
import { detectLanguage, languageInstruction } from "./detectLanguage";
import type { InterviewCoachFormData, InterviewCoachResult } from "@/types/builder";

export async function coachInterview(
  form: InterviewCoachFormData,
): Promise<{ result: InterviewCoachResult; analysis: string }> {
  // First call: Generate structured interview questions and coaching data
  const systemPrompt1 = `You are an expert technical interviewer and career coach. Generate tailored interview preparation material. Return ONLY valid JSON — no markdown fences, no commentary outside the JSON object.`;

  const jobDesc = form.jobDescription.slice(0, 3000);
  const resumeSum = form.resumeSummary.slice(0, 8000);

  const userPrompt1 = `Generate interview preparation material for the following:

Role: ${form.jobTitle} at ${form.company}
Interview Type: ${form.interviewType}
Job Description:
---
${jobDesc}
---

Candidate Resume Summary:
---
${resumeSum}
---

Return ONLY this JSON:
{
  "questions": [
    {
      "category": "<Technical|Behavioral|Situational|Role-Specific>",
      "question": "<the full interview question>",
      "tip": "<one concrete sentence on how to answer it well>"
    }
  ],
  "keyStrengths": ["<strength based on resume vs role>", ...],
  "commonPitfalls": ["<mistake candidates make for this role/type>", ...],
  "closingQuestions": ["<smart question for candidate to ask interviewer>", ...]
}

Rules:
- questions: generate 8–12 questions; mix categories to match the interviewType
  - "behavioral": weight 70% Behavioral, 30% Situational
  - "technical": weight 70% Technical, 30% Role-Specific
  - "mixed": spread evenly across all four categories
- keyStrengths: 4–6 items, directly tied to both the resume summary AND the job requirements
- commonPitfalls: 3–5 items specific to this role type and interview format
- closingQuestions: 3–5 smart, specific questions the candidate should ask the interviewer`;

  const lang = detectLanguage(form.resumeSummary + " " + form.jobDescription);
  const langInst = languageInstruction(lang);
  const raw1 = await callClaude(systemPrompt1 + "\n" + langInst, userPrompt1, 2500);
  const jsonStr = extractJson(raw1);
  const result = JSON.parse(jsonStr) as InterviewCoachResult;

  // Second call: Generate personalized preparation narrative
  const systemPrompt2 = `You are an experienced interview coach. Write a personalized, encouraging, and practical preparation narrative. Use plain text paragraphs only — no markdown headers, no bullet points, no JSON.`;

  const userPrompt2 = `Write a 3–4 paragraph interview preparation narrative for ${form.jobTitle} at ${form.company}.
The candidate's strengths identified are: ${result.keyStrengths.join(", ")}.
The interview type is: ${form.interviewType}.

Cover:
1. What to study and prioritize in the next few days before the interview
2. Mindset and confidence-building advice specific to a ${form.interviewType} interview
3. How to structure answers using their identified strengths
4. One closing piece of advice that is specific to the ${form.company} role

Be warm, direct, and specific. Do not use bullet points or markdown.`;

  const analysis = await callClaude(systemPrompt2 + "\n" + langInst, userPrompt2, 1200);

  return { result, analysis };
}
