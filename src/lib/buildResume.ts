import type { ResumeFormData } from "@/types/builder";
import { callClaude } from "./callClaude";

const SYSTEM_PROMPT = `You are an expert resume writer. Your task is to produce a polished, professional resume in Markdown format based on the structured data provided. Return ONLY the Markdown — no commentary, no code fences, no preamble. Use # for the candidate's name, ## for section headings, and achievement-focused bullet points starting with strong action verbs.`;

function buildUserPrompt(data: ResumeFormData): string {
  const lines: string[] = [];

  lines.push(`Name: ${data.fullName}`);
  lines.push(`Email: ${data.email}`);
  if (data.phone) lines.push(`Phone: ${data.phone}`);
  if (data.location) lines.push(`Location: ${data.location}`);
  if (data.linkedIn) lines.push(`LinkedIn: ${data.linkedIn}`);
  if (data.github) lines.push(`GitHub: ${data.github}`);
  lines.push("");

  if (data.summary) {
    lines.push(`Summary: ${data.summary}`);
    lines.push("");
  }

  lines.push("WORK EXPERIENCE:");
  for (const entry of data.workEntries) {
    lines.push(`  Company: ${entry.company}`);
    lines.push(`  Title: ${entry.title}`);
    lines.push(`  Dates: ${entry.startDate} – ${entry.endDate}`);
    if (entry.bullets.filter(Boolean).length > 0) {
      lines.push("  Achievements:");
      for (const bullet of entry.bullets.filter(Boolean)) {
        lines.push(`    - ${bullet}`);
      }
    }
    lines.push("");
  }

  lines.push("EDUCATION:");
  for (const entry of data.educationEntries) {
    const gpa = entry.gpa ? ` | GPA: ${entry.gpa}` : "";
    lines.push(`  ${entry.degree} | ${entry.school} | ${entry.graduationYear}${gpa}`);
  }
  lines.push("");

  lines.push("SKILLS:");
  if (data.technicalSkills) lines.push(`  Technical: ${data.technicalSkills}`);
  if (data.softSkills) lines.push(`  Soft Skills: ${data.softSkills}`);
  if (data.certifications) lines.push(`  Certifications: ${data.certifications}`);
  if (data.languages) lines.push(`  Languages: ${data.languages}`);
  if (data.projects) {
    lines.push("");
    lines.push(`PROJECTS:\n${data.projects}`);
  }

  return lines.join("\n");
}

export async function buildResume(data: ResumeFormData): Promise<string> {
  return callClaude(SYSTEM_PROMPT, buildUserPrompt(data), 4000);
}
