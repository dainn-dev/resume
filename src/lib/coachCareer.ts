import { callClaude, extractJson } from "./callClaude";
import { detectLanguage, languageInstruction } from "./detectLanguage";
import type { CareerCoachFormData, CareerCoachResult } from "@/types/builder";

export async function coachCareer(
  form: CareerCoachFormData,
): Promise<{ result: CareerCoachResult; analysis: string }> {
  const systemPrompt1 = `You are an expert career strategist and coach with deep knowledge of industry trends, skill development pathways, and job market dynamics. Generate a personalized career development plan. Return ONLY valid JSON — no markdown fences, no commentary outside the JSON object.`;

  const userPrompt1 = `Create a comprehensive career coaching plan for this professional:

Career Goal: ${form.careerGoal}
Timeline: ${form.timeline}
Focus Areas: ${form.focusAreas.join(", ")}
${form.additionalContext ? `Additional Context: ${form.additionalContext}` : ""}

Current Profile:
---
Skills: ${form.currentSkills.slice(0, 2000)}
Experience: ${form.experienceSummary.slice(0, 3000)}
Resume Summary: ${form.resumeSummary.slice(0, 4000)}
${form.jobMatchGaps ? `Identified Skill Gaps: ${form.jobMatchGaps.slice(0, 1500)}` : ""}
${form.salaryInsights ? `Market/Salary Context: ${form.salaryInsights.slice(0, 1000)}` : ""}
---

Return ONLY this JSON:
{
  "careerRoadmap": [
    {
      "timeframe": "<e.g. 0-6 months>",
      "goal": "<milestone description>",
      "actions": ["<specific action 1>", "<specific action 2>"]
    }
  ],
  "skillDevelopment": [
    {
      "skill": "<skill name>",
      "priority": "<high|medium|low>",
      "reason": "<why this skill matters for the goal>",
      "resources": ["<specific course/book/cert>"]
    }
  ],
  "jobSearchStrategy": ["<actionable strategy>"],
  "quickWins": ["<immediate action the user can do this week>"],
  "industryOutlook": "<2-3 paragraph analysis of trends in their target field>"
}

Rules:
- careerRoadmap: 3-5 milestones spread across the ${form.timeline} timeline
- skillDevelopment: 4-6 skills, prioritized by impact on reaching the career goal
- jobSearchStrategy: 5-7 concrete strategies (where to look, how to network, application tactics)
- quickWins: 3-5 things they can do THIS WEEK (LinkedIn optimization, portfolio, specific cert to start)
- industryOutlook: ground this in real trends for their target role/industry
- Do NOT duplicate salary negotiation advice
- Do NOT duplicate interview preparation advice
- Do NOT duplicate resume section-by-section tips
- Focus on CAREER TRAJECTORY, SKILL GROWTH, and JOB SEARCH STRATEGY`;

  const lang = detectLanguage(form.resumeSummary + " " + form.careerGoal);
  const langInst = languageInstruction(lang);
  const raw1 = await callClaude(systemPrompt1 + "\n" + langInst, userPrompt1, 3000);
  const result = JSON.parse(extractJson(raw1)) as CareerCoachResult;

  const systemPrompt2 = `You are a supportive and experienced career mentor. Write a personalized, motivating career advice narrative. Use plain text paragraphs only — no markdown headers, no bullet points, no JSON.`;

  const highPrioritySkills = result.skillDevelopment
    .filter(s => s.priority === "high")
    .map(s => s.skill)
    .join(", ");

  const firstMilestones = result.careerRoadmap
    .slice(0, 2)
    .map(m => m.goal)
    .join("; ");

  const userPrompt2 = `Write a 3-4 paragraph personalized career advice narrative for someone aiming to become a ${form.careerGoal} within ${form.timeline}.

Their key strengths are in: ${form.currentSkills.slice(0, 500)}
The roadmap identified these first milestones: ${firstMilestones}
Top skills to develop: ${highPrioritySkills}

Cover:
1. An encouraging assessment of where they stand relative to their goal
2. The single most impactful thing they should focus on first
3. How to stay motivated and measure progress over ${form.timeline}
4. A closing insight specific to their target career path

Be warm, direct, and specific. Do not use bullet points or markdown.`;

  const analysis = await callClaude(systemPrompt2 + "\n" + langInst, userPrompt2, 1200);

  return { result, analysis };
}
