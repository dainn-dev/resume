import type { SalaryEstimatorFormData, SalaryEstimate } from "@/types/builder";
import { callClaude, extractJson } from "./callClaude";
import { detectLanguage, languageInstruction } from "./detectLanguage";

const SYSTEM_PROMPT = `You are an expert salary analyst specializing in tech industry compensation. Provide MONTHLY salary estimates in both USD and VND for Vietnamese market. Be accurate and realistic based on actual market data. Return ONLY valid JSON — no markdown fences, no commentary outside the JSON.`;

function determineLevel(experience: string): string {
  if (experience.includes("0-2")) return "Junior";
  if (experience.includes("2-5")) return "Mid-level";
  if (experience.includes("5-10")) return "Senior";
  return "Senior+";
}

function buildUserPrompt(form: SalaryEstimatorFormData): string {
  const level = determineLevel(form.experience);
  const isVietnam = form.location.toLowerCase().includes("vietnam") || form.location.toLowerCase().includes("hanoi") || form.location.toLowerCase().includes("hcm") || form.location.toLowerCase().includes("ho chi minh");

  return `Analyze the following job profile and provide MONTHLY salary estimates for the tech market:

Job Title: ${form.jobTitle} (${level} Level)
Industry: ${form.industry}
Years of Experience: ${form.experience}
Location: ${form.location}
Key Skills: ${form.skills}
Education: ${form.education}

IMPORTANT:
${isVietnam ? `- Location is VIETNAM. Provide realistic VND and USD estimates for Vietnamese market.
- Base on actual Vietnam tech salary data
- Senior role in Vietnam: typically 40-80 million VND/month or $1,500-$3,000 USD/month
- Mid-level: 25-40 million VND/month or $1,000-$1,500 USD/month
- Junior: 15-25 million VND/month or $600-$1,000 USD/month
- Remote work for US/EU companies can be 2-3x higher` : `- Adjust salary based on local market conditions
- Consider cost of living and currency exchange`}

Return ONLY this JSON (MONTHLY salary figures):
{
  "minSalary": <number - minimum monthly salary>,
  "maxSalary": <number - maximum monthly salary>,
  "medianSalary": <number - median monthly salary>,
  "currency": "${isVietnam ? 'VND' : 'USD'}",
  "alternativeCurrency": "${isVietnam ? 'USD' : 'VND'}",
  "minSalaryAlt": <number - minimum in alternative currency>,
  "maxSalaryAlt": <number - maximum in alternative currency>,
  "medianSalaryAlt": <number - median in alternative currency>,
  "confidence": "<HIGH|MEDIUM|LOW - confidence level>",
  "factors": [
    "<factor 1 - skill impact>",
    "<factor 2 - market demand>",
    "<factor 3 - location advantage>"
  ],
  "marketInsights": "<2-3 sentence insight about current market conditions, demand for this role, and salary trends in this location>"
}`;
}

export async function estimateSalary(form: SalaryEstimatorFormData): Promise<{ estimate: SalaryEstimate; analysis: string }> {
  const lang = detectLanguage(form.jobTitle + " " + form.skills + " " + form.location);
  const langInst = languageInstruction(lang);
  const raw = await callClaude(SYSTEM_PROMPT + "\n" + langInst, buildUserPrompt(form), 1500);
  const estimate = JSON.parse(extractJson(raw)) as SalaryEstimate;

  // Generate a detailed analysis text
  const levelText = determineLevel(form.experience);
  const isVietnam = form.location.toLowerCase().includes("vietnam") || form.location.toLowerCase().includes("hanoi") || form.location.toLowerCase().includes("hcm");

  const salaryDisplay = isVietnam
    ? `${(estimate.medianSalary / 1000000).toFixed(1)} triệu VND/tháng (~$${estimate.medianSalaryAlt?.toLocaleString() || 'N/A'}/tháng)`
    : `$${estimate.medianSalary.toLocaleString()}/tháng`;

  const analysisPrompt = `You are an experienced career advisor for ${form.location}. Based on these MONTHLY salary estimates for a ${levelText} ${form.jobTitle} role:
- Median: ${salaryDisplay}
- Range: ${estimate.minSalary.toLocaleString()}-${estimate.maxSalary.toLocaleString()} ${estimate.currency}/tháng

Write 2-3 practical paragraphs about:
1. How this ${levelText}-level salary positions the candidate in the market
2. Concrete negotiation strategies based on their ${form.experience} experience and skills: ${form.skills}
3. Realistic career growth and salary increase potential in the next 3-5 years
4. ${isVietnam ? 'Comparison with remote work opportunities (can earn 2-3x more)' : 'Relocation or remote opportunities'}

Be encouraging, realistic, and specific with numbers.`;

  const analysisRaw = await callClaude("You are a helpful career advisor providing actionable salary guidance.\n" + langInst, analysisPrompt, 1200);

  return {
    estimate,
    analysis: analysisRaw,
  };
}
