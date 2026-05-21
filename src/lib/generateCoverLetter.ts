import type { CoverLetterFormData } from "@/types/builder";
import { callClaude } from "./callClaude";
import { detectLanguage, languageInstruction } from "./detectLanguage";

const SYSTEM_PROMPTS = {
  Professional: `You are an expert cover letter writer specializing in formal, precise business communication. Write a cover letter that is structured, polished, and authoritative. Use a clear three-part structure: strong opening that states the position and a key qualification, middle paragraph matching the applicant's experience to the role, and a confident call-to-action closing. Address to "Hiring Manager". Sign off with "Sincerely,". Return ONLY the cover letter text — no commentary.`,

  Enthusiastic: `You are an expert cover letter writer who crafts energetic, memorable cover letters that show genuine passion and personality. Write a cover letter that stands out with authentic enthusiasm, memorable phrasing, and a clear connection between the applicant's passion and the company's mission. Still professional, but with energy and personality. Address to "Hiring Manager". Sign off with "Sincerely,". Return ONLY the cover letter text — no commentary.`,

  Concise: `You are an expert cover letter writer who values brevity and impact. Write a tight, punchy cover letter of exactly 3 paragraphs where every sentence earns its place. No filler words, no clichés, no padding. Each paragraph must do work: opening hooks + states the position, middle shows the best 1-2 relevant achievements, closing is a direct CTA. Address to "Hiring Manager". Sign off with "Sincerely,". Return ONLY the cover letter text — no commentary.`,
};

function buildUserPrompt(data: CoverLetterFormData): string {
  const lengthGuide = data.tone === "Concise" ? "150-200 words" : "250-350 words";
  return `Position: ${data.jobTitle} at ${data.company}

Job Description:
${data.jobDescription}

About the Applicant:
${data.aboutYourself}

Target length: ${lengthGuide}
Address the letter to "Hiring Manager". End with "Sincerely,".`;
}

export async function generateCoverLetter(data: CoverLetterFormData): Promise<string> {
  const lang = detectLanguage(data.aboutYourself + " " + data.jobDescription);
  const prompt = SYSTEM_PROMPTS[data.tone] + "\n" + languageInstruction(lang);
  return callClaude(prompt, buildUserPrompt(data), 1000);
}
