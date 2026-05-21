const PREFIX = "stepResults_";

export interface StepResults {
  jobMatch?: { matchScore: number; summary: string; strengths: string[]; gaps: string[] };
  coverLetter?: { text: string };
  salary?: { minSalary: number; maxSalary: number; medianSalary: number; currency: string; confidence: string; analysis: string };
  interview?: { questionCount: number; keyStrengths: string[]; analysis: string };
  career?: { milestoneCount: number; quickWins: string[]; analysis: string };
}

export function getStepResults(resumeId: string): StepResults | null {
  try {
    const raw = localStorage.getItem(PREFIX + resumeId);
    return raw ? (JSON.parse(raw) as StepResults) : null;
  } catch {
    return null;
  }
}

export function saveStepResult(resumeId: string, step: keyof StepResults, data: StepResults[typeof step]): void {
  try {
    const existing = getStepResults(resumeId) ?? {};
    const updated = { ...existing, [step]: data };
    localStorage.setItem(PREFIX + resumeId, JSON.stringify(updated));
  } catch {
    // ignore
  }
}
