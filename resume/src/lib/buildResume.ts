import type { ResumeFormData } from "@/types/builder";
import { callClaude } from "./callClaude";
import { detectLanguage, languageInstruction } from "./detectLanguage";

const SYSTEM_PROMPT = `You are an expert resume writer. Your task is to produce a polished, professional resume in Markdown format based on the structured data provided. Return ONLY the Markdown — no commentary, no code fences, no preamble. Use # for the candidate's name, ## for section headings, and achievement-focused bullet points starting with strong action verbs. When a company has multiple roles, list them under a single company heading with each role as a sub-entry showing its own title, project (if provided), dates, and achievements.`;

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
  const grouped = new Map<string, typeof data.workEntries>();
  for (const entry of data.workEntries) {
    const key = entry.company.trim();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(entry);
  }
  for (const [company, entries] of grouped) {
    lines.push(`  Company: ${company}`);
    for (const entry of entries) {
      lines.push(`    Role: ${entry.title}`);
      if (entry.projectName) lines.push(`    Project: ${entry.projectName}`);
      lines.push(`    Dates: ${entry.startDate} – ${entry.endDate}`);
      if (entry.bullets.filter(Boolean).length > 0) {
        lines.push("    Achievements:");
        for (const bullet of entry.bullets.filter(Boolean)) {
          lines.push(`      - ${bullet}`);
        }
      }
      lines.push("");
    }
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
  const lang = detectLanguage(data.summary + " " + data.technicalSkills);
  const prompt = SYSTEM_PROMPT + "\n" + languageInstruction(lang);
  return callClaude(prompt, buildUserPrompt(data), 4000);
}
