using System.Text;
using DResume.Api.Contracts;

namespace DResume.Api.Ai;

public static class PromptLibrary
{
    private static string Truncate(string s, int n) => s.Length <= n ? s : s[..n];

    public const string AnalyzeSectionSystem =
        "You are an expert resume coach. Evaluate ONE section of a resume using the EXACT scoring rubric provided. Be consistent: the same content must always produce the same score. You must ONLY return valid JSON.";

    private static readonly Dictionary<string, string> SectionRubrics = new()
    {
        ["Contact Information"] = @"Score based on these criteria (each worth points out of 100):
- Full name present and professional (15 pts)
- Email address present and professional, not novelty (15 pts)
- Phone number with country code (15 pts)
- Location/city included (15 pts)
- LinkedIn URL present and complete (20 pts)
- GitHub/portfolio URL if tech role (10 pts)
- Clean formatting, no duplicate numbers (10 pts)
Deduct 5 pts per missing item. Score 0 only if section is completely absent.",

        ["Summary / Objective"] = @"Score based on these criteria (each worth points out of 100):
- Present and at least 2 sentences (15 pts)
- States years of experience and seniority level (15 pts)
- Mentions core technical skills or domain expertise (20 pts)
- Includes 1+ quantified achievement or impact metric (20 pts)
- Tailored to target role, not generic (15 pts)
- Concise, under 4 sentences (15 pts)
Deduct points proportionally for weak areas. Score 0 only if section is completely absent.",

        ["Work Experience"] = @"Score based on these criteria (each worth points out of 100):
- Uses reverse chronological order (10 pts)
- Each role has company, title, and dates (10 pts)
- Bullet points start with strong action verbs (15 pts)
- At least 50% of bullets have quantified results (numbers, %, $) (20 pts)
- Bullets show impact/outcome, not just responsibilities (20 pts)
- 3-6 bullets per role, not too few or too many (10 pts)
- Consistent date format throughout (5 pts)
- No gaps or overlapping dates without explanation (10 pts)
Deduct points proportionally. Score 0 only if section is completely absent.",

        ["Education"] = @"Score based on these criteria (each worth points out of 100):
- Degree and institution name present (25 pts)
- Graduation year included (15 pts)
- GPA included if above 3.0 or equivalent (10 pts)
- Relevant certifications listed (20 pts)
- Relevant coursework or honors if junior candidate (15 pts)
- Clean formatting (15 pts)
For senior candidates (7+ years), education section is less critical — be lenient on missing GPA/coursework.",

        ["Skills"] = @"Score based on these criteria (each worth points out of 100):
- Technical skills organized by category (20 pts)
- Skills are specific, not vague (e.g. 'Python' not 'programming') (20 pts)
- Skills match the work experience described (20 pts)
- Proficiency levels indicated or implied by grouping (15 pts)
- No outdated or irrelevant skills padding the list (10 pts)
- Soft skills or leadership mentioned if senior role (15 pts)
Score 0 only if section is completely absent.",

        ["Formatting & Readability"] = @"Score based on these criteria (each worth points out of 100):
- Resume is 1-2 pages (3 max for 10+ years experience) (25 pts)
- Consistent heading hierarchy and visual structure (20 pts)
- Consistent bullet point style (no mixing •, -, numbered) (15 pts)
- Adequate white space, not dense walls of text (15 pts)
- No spelling or grammar errors visible (15 pts)
- ATS-friendly (no tables, columns, images) (10 pts)
Be lenient on length for senior candidates with 7+ years experience.",
    };

    public static string AnalyzeSectionUser(string resumeText, string sectionKey, string sectionLabel) =>
        $@"Analyze the ""{sectionLabel}"" section of the following resume using this EXACT scoring rubric:

{SectionRubrics.GetValueOrDefault(sectionLabel, "Score 0-100 based on completeness, clarity, and impact.")}

RESUME:
---
{Truncate(resumeText, 10000)}
---

Return ONLY this JSON:
{{
  ""score"": <0-100 per rubric above>,
  ""label"": ""{sectionLabel}"",
  ""tips"": [
    {{ ""problem"": ""<specific issue referencing actual resume content>"", ""suggestion"": ""<concrete rewrite or example>"" }}
  ]
}}

Rules:
- 2–3 tips only, keep each under 100 words
- Calculate score by summing points from the rubric — show your math mentally
- If section is missing entirely, score 0";

    public const string AnalyzeSummarySystem =
        "You are an expert resume coach. Calculate the overall score using the EXACT weights provided. Return ONLY valid JSON.";

    public static string AnalyzeSummaryUser(Dictionary<string, int> sectionScores) =>
        $@"Calculate the weighted overall score using these EXACT weights:
- Work Experience: 30% (most important)
- Skills: 20%
- Summary/Objective: 15%
- Formatting & Readability: 15%
- Contact Information: 10%
- Education: 10%

Section scores: {string.Join(", ", sectionScores.Select(kv => $"{kv.Key}: {kv.Value}/100"))}

Compute: overallScore = round(workExperience*0.30 + skills*0.20 + summary*0.15 + formatting*0.15 + contactInfo*0.10 + education*0.10)

Return ONLY this JSON:
{{
  ""overallScore"": <calculated weighted average, integer>,
  ""overallSummary"": ""<2-3 sentence summary of strengths and weaknesses>""
}}";

    public static readonly (string Key, string Label)[] AnalyzeSections =
    [
        ("contactInfo", "Contact Information"),
        ("summary", "Summary / Objective"),
        ("workExperience", "Work Experience"),
        ("education", "Education"),
        ("skills", "Skills"),
        ("formatting", "Formatting & Readability"),
    ];

    public const string ParseSystem =
        "You are an expert resume parser. Extract the candidate's information from the resume text and return a JSON object matching the exact schema provided. Return ONLY valid JSON — no markdown fences, no commentary outside the JSON.";

    public static string ParseUser(string resumeText) =>
        $@"Parse the following resume and extract all information into this exact JSON schema. Use empty strings for missing fields, empty arrays for missing lists.

RESUME TEXT:
---
{Truncate(resumeText, 24000)}
---

Return ONLY this JSON:
{{
  ""fullName"": ""<candidate full name>"",
  ""email"": ""<email address>"",
  ""phone"": ""<phone number>"",
  ""location"": ""<city, state or country>"",
  ""linkedIn"": ""<LinkedIn URL if present, else empty string>"",
  ""github"": ""<GitHub URL if present, else empty string>"",
  ""summary"": ""<professional summary or objective if present, else empty string>"",
  ""workEntries"": [{{ ""company"": ""<company name>"", ""projectName"": ""<project name if mentioned, else empty string>"", ""title"": ""<job title>"", ""startDate"": ""<start month/year>"", ""endDate"": ""<end month/year or Present>"", ""bullets"": [""<achievement 1>"", ""<achievement 2>""] }}],
  ""educationEntries"": [{{ ""school"": ""<school name>"", ""degree"": ""<degree>"", ""graduationYear"": ""<year>"", ""gpa"": ""<GPA if listed, else empty string>"" }}],
  ""technicalSkills"": ""<comma-separated technical skills>"",
  ""softSkills"": ""<comma-separated soft skills if listed>"",
  ""certifications"": ""<certifications if listed>"",
  ""languages"": ""<spoken languages if listed>"",
  ""projects"": ""<notable projects if listed, else empty string>""
}}";

    public const string ImproveSystem =
        "You are an expert resume writer who optimizes resumes to score maximum points on a specific rubric. Return ONLY valid JSON — no markdown, no commentary.";

    private const string ImproveRubric = @"SCORING RUBRIC:
CONTACT INFO (10%): Name(15), Email(15), Phone+country-code(15), Location(15), LinkedIn-URL(20), GitHub-URL(10), Clean-format(10)
SUMMARY (15%): Present-2+sentences(15), Years+seniority(15), Core-skills(20), Quantified-achievement(20), Tailored(15), Concise<4-sentences(15)
WORK EXPERIENCE (30%): Reverse-chrono(10), Company/title/dates(10), Action-verbs(15), 50%+-quantified-bullets(20), Impact-not-duties(20), 3-6-bullets-per-role(10), Consistent-dates(5), No-gaps(10)
EDUCATION (10%): Degree+school(25), Year(15), GPA-if>3.0(10), Certs(20), Coursework(15), Format(15)
SKILLS (20%): Categorized(20), Specific-not-vague(20), Match-experience(20), Proficiency(15), No-padding(10), Soft-skills(15)
FORMATTING (15%): 1-2-pages(25), Consistent-headings(20), Bullet-style(15), White-space(15), No-errors(15), ATS-friendly(10)";

    public static string ImproveUser(string currentFormJson, string tipsJson) =>
        $@"Improve this resume AND score it using the rubric below.

{ImproveRubric}

CURRENT RESUME DATA:
{Truncate(currentFormJson, 12000)}

RECOMMENDATIONS TO APPLY:
{Truncate(tipsJson, 6000)}

Return ONLY this JSON with both improved resume AND scores:
{{
  ""resume"": {{
    ""fullName"": ""..."", ""email"": ""..."", ""phone"": ""..."", ""location"": ""..."",
    ""linkedIn"": ""..."", ""github"": ""..."", ""summary"": ""..."",
    ""workEntries"": [{{ ""company"": ""..."", ""projectName"": ""..."", ""title"": ""..."", ""startDate"": ""..."", ""endDate"": ""..."", ""bullets"": [""...""] }}],
    ""educationEntries"": [{{ ""school"": ""..."", ""degree"": ""..."", ""graduationYear"": ""..."", ""gpa"": ""..."" }}],
    ""technicalSkills"": ""..."", ""softSkills"": ""..."", ""certifications"": ""..."", ""languages"": ""..."", ""projects"": ""...""
  }},
  ""scores"": {{
    ""contactInfo"": <0-100 sum rubric points>,
    ""summary"": <0-100>,
    ""workExperience"": <0-100>,
    ""education"": <0-100>,
    ""skills"": <0-100>,
    ""formatting"": <0-100>
  }}
}}

Rules:
- Apply every recommendation targeting the rubric points
- Rewrite bullets: action verbs + quantified results (numbers, %, $) in 50%+ of bullets
- Add phone country code if missing, add location if missing
- Keep factual information (names, dates, companies) unchanged
- Score MUST be higher than before — calculate by summing rubric points for the IMPROVED version
- Be strict and honest with scoring — only award points the improved content actually earns";

    public const string JobMatchSystem =
        "You are an expert technical recruiter and career coach. Analyze how well a candidate's resume matches a job description and return a structured JSON analysis. You must ONLY return valid JSON — no markdown, no commentary outside the JSON.";

    public static string JobMatchUser(string resumeText, string jobDescription) =>
        $@"Compare the resume below against the job description and return a JSON object matching this exact schema.

RESUME:
---
{Truncate(resumeText, 18000)}
---

JOB DESCRIPTION:
---
{Truncate(jobDescription, 12000)}
---

Return ONLY this JSON structure:
{{
  ""jobTitle"": ""<job title extracted from the job description>"",
  ""company"": ""<company name extracted from the job description>"",
  ""matchScore"": <number 0-100>,
  ""summary"": ""<2-3 sentences: fit, top strength, biggest gap>"",
  ""strengths"": [""<specific resume element that matches job requirement>""],
  ""gaps"": [""<specific missing skill, experience, or qualification>""],
  ""suggestions"": [{{ ""area"": ""<skill or section>"", ""improvement"": ""<concrete, ready-to-use resume change>"" }}],
  ""keywordMatch"": {{ ""matched"": [""<keyword found in both>""], ""missing"": [""<important JD keyword absent from resume>""] }}
}}

Rules:
- matchScore: 0–100. 80+ = strong match, 60–79 = moderate, below 60 = significant gaps
- strengths: 3–5 items
- gaps: 3–5 items
- suggestions: 3–4 concrete rewrites
- keywordMatch.matched: 5–10 keywords
- keywordMatch.missing: 5–10 keywords";

    public const string BuildSystem =
        "You are an expert resume writer. Your task is to produce a polished, professional resume in Markdown format based on the structured data provided. Return ONLY the Markdown — no commentary, no code fences, no preamble. Use # for the candidate's name, ## for section headings, ### for company names, and achievement-focused bullet points starting with strong action verbs. When a company has multiple roles, list them under a single ### company heading with each role as a sub-entry showing its own title, project (if provided), dates, and achievements. NEVER use horizontal rules (---, ***, ___) anywhere in the output. NEVER create a 'Selected Projects' or 'Projects' section — project names must only appear inline within the work experience entries where they belong.";

    public static string BuildUser(ResumeFormDataDto d)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Name: {d.FullName}");
        sb.AppendLine($"Email: {d.Email}");
        if (!string.IsNullOrEmpty(d.Phone)) sb.AppendLine($"Phone: {d.Phone}");
        if (!string.IsNullOrEmpty(d.Location)) sb.AppendLine($"Location: {d.Location}");
        if (!string.IsNullOrEmpty(d.LinkedIn)) sb.AppendLine($"LinkedIn: {d.LinkedIn}");
        if (!string.IsNullOrEmpty(d.Github)) sb.AppendLine($"GitHub: {d.Github}");
        sb.AppendLine();
        if (!string.IsNullOrEmpty(d.Summary)) { sb.AppendLine($"Summary: {d.Summary}"); sb.AppendLine(); }

        sb.AppendLine("WORK EXPERIENCE:");
        foreach (var group in d.WorkEntries.GroupBy(e => e.Company.Trim()))
        {
            sb.AppendLine($"  Company: {group.Key}");
            foreach (var entry in group)
            {
                sb.AppendLine($"    Role: {entry.Title}");
                if (!string.IsNullOrEmpty(entry.ProjectName)) sb.AppendLine($"    Project: {entry.ProjectName}");
                sb.AppendLine($"    Dates: {entry.StartDate} – {entry.EndDate}");
                var bullets = entry.Bullets.Where(b => !string.IsNullOrWhiteSpace(b)).ToList();
                if (bullets.Count > 0)
                {
                    sb.AppendLine("    Achievements:");
                    foreach (var b in bullets) sb.AppendLine($"      - {b}");
                }
                sb.AppendLine();
            }
        }

        sb.AppendLine("EDUCATION:");
        foreach (var e in d.EducationEntries)
        {
            var gpa = !string.IsNullOrEmpty(e.Gpa) ? $" | GPA: {e.Gpa}" : "";
            sb.AppendLine($"  {e.Degree} | {e.School} | {e.GraduationYear}{gpa}");
        }
        sb.AppendLine();

        sb.AppendLine("SKILLS:");
        if (!string.IsNullOrEmpty(d.TechnicalSkills)) sb.AppendLine($"  Technical: {d.TechnicalSkills}");
        if (!string.IsNullOrEmpty(d.SoftSkills)) sb.AppendLine($"  Soft Skills: {d.SoftSkills}");
        if (!string.IsNullOrEmpty(d.Certifications)) sb.AppendLine($"  Certifications: {d.Certifications}");
        if (!string.IsNullOrEmpty(d.Languages)) sb.AppendLine($"  Languages: {d.Languages}");
        if (!string.IsNullOrEmpty(d.Projects)) { sb.AppendLine(); sb.AppendLine($"PROJECTS:{Environment.NewLine}{d.Projects}"); }

        return sb.ToString();
    }

    public static string CoverLetterSystem(string tone) => tone switch
    {
        "Professional" => "You are an expert cover letter writer specializing in formal, precise business communication. Write a cover letter that is structured, polished, and authoritative. Use a clear three-part structure: strong opening that states the position and a key qualification, middle paragraph matching the applicant's experience to the role, and a confident call-to-action closing. Address to \"Hiring Manager\". Sign off with \"Sincerely,\". Return ONLY the cover letter text — no commentary.",
        "Enthusiastic" => "You are an expert cover letter writer who crafts energetic, memorable cover letters that show genuine passion and personality. Write a cover letter that stands out with authentic enthusiasm, memorable phrasing, and a clear connection between the applicant's passion and the company's mission. Still professional, but with energy and personality. Address to \"Hiring Manager\". Sign off with \"Sincerely,\". Return ONLY the cover letter text — no commentary.",
        "Concise" => "You are an expert cover letter writer who values brevity and impact. Write a tight, punchy cover letter of exactly 3 paragraphs where every sentence earns its place. No filler words, no clichés, no padding. Each paragraph must do work: opening hooks + states the position, middle shows the best 1-2 relevant achievements, closing is a direct CTA. Address to \"Hiring Manager\". End with \"Sincerely,\". Return ONLY the cover letter text — no commentary.",
        _ => "You are an expert cover letter writer. Return ONLY the cover letter text — no commentary."
    };

    public static string CoverLetterUser(CoverLetterFormDataDto d)
    {
        var lengthGuide = d.Tone == "Concise" ? "150-200 words" : "250-350 words";
        return $@"Position: {d.JobTitle} at {d.Company}

Job Description:
{d.JobDescription}

About the Applicant:
{d.AboutYourself}

Target length: {lengthGuide}
Address the letter to ""Hiring Manager"". End with ""Sincerely,"".";
    }

    public const string CareerCoachSystem1 =
        "You are an expert career strategist and coach with deep knowledge of industry trends, skill development pathways, and job market dynamics. Generate a personalized career development plan. Return ONLY valid JSON — no markdown fences, no commentary outside the JSON object.";

    public const string CareerCoachSystem2 =
        "You are a supportive and experienced career mentor. Write a personalized, motivating career advice narrative. Use plain text paragraphs only — no markdown headers, no bullet points, no JSON.";

    public static string CareerCoachUser1(CareerCoachFormDataDto f)
    {
        var ctx = !string.IsNullOrWhiteSpace(f.AdditionalContext) ? $"Additional Context: {f.AdditionalContext}" : "";
        var gaps = !string.IsNullOrWhiteSpace(f.JobMatchGaps) ? $"Identified Skill Gaps: {Truncate(f.JobMatchGaps!, 1500)}" : "";
        var salary = !string.IsNullOrWhiteSpace(f.SalaryInsights) ? $"Market/Salary Context: {Truncate(f.SalaryInsights!, 1000)}" : "";

        return $@"Create a comprehensive career coaching plan for this professional:

Career Goal: {f.CareerGoal}
Timeline: {f.Timeline}
Focus Areas: {string.Join(", ", f.FocusAreas)}
{ctx}

Current Profile:
---
Skills: {Truncate(f.CurrentSkills, 2000)}
Experience: {Truncate(f.ExperienceSummary, 3000)}
Resume Summary: {Truncate(f.ResumeSummary, 4000)}
{gaps}
{salary}
---

Return ONLY this JSON:
{{
  ""careerRoadmap"": [{{ ""timeframe"": ""<e.g. 0-6 months>"", ""goal"": ""<milestone>"", ""actions"": [""<action 1>"", ""<action 2>""] }}],
  ""skillDevelopment"": [{{ ""skill"": ""<skill>"", ""priority"": ""<high|medium|low>"", ""reason"": ""<why>"", ""resources"": [""<resource>""] }}],
  ""jobSearchStrategy"": [""<strategy>""],
  ""quickWins"": [""<this-week action>""],
  ""industryOutlook"": ""<2-3 paragraph analysis>""
}}

Rules:
- careerRoadmap: 3-5 milestones spread across the {f.Timeline} timeline
- skillDevelopment: 4-6 skills, prioritized by impact
- jobSearchStrategy: 5-7 concrete strategies
- quickWins: 3-5 things they can do THIS WEEK
- industryOutlook: ground in real trends
- Focus on CAREER TRAJECTORY, SKILL GROWTH, and JOB SEARCH STRATEGY";
    }

    public static string CareerCoachUser2(CareerCoachFormDataDto f, CareerCoachResultDto r)
    {
        var highPriority = string.Join(", ", r.SkillDevelopment.Where(s => s.Priority == "high").Select(s => s.Skill));
        var firstMilestones = string.Join("; ", r.CareerRoadmap.Take(2).Select(m => m.Goal));
        return $@"Write a 3-4 paragraph personalized career advice narrative for someone aiming to become a {f.CareerGoal} within {f.Timeline}.

Their key strengths are in: {Truncate(f.CurrentSkills, 500)}
The roadmap identified these first milestones: {firstMilestones}
Top skills to develop: {highPriority}

Cover:
1. Encouraging assessment of where they stand
2. The single most impactful first focus
3. How to stay motivated and measure progress over {f.Timeline}
4. A closing insight specific to their target career path

Be warm, direct, and specific. Do not use bullet points or markdown.";
    }

    public const string InterviewCoachSystem1 =
        "You are an expert technical interviewer and career coach. Generate tailored interview preparation material. Return ONLY valid JSON — no markdown fences, no commentary outside the JSON object.";

    public const string InterviewCoachSystem2 =
        "You are an experienced interview coach. Write a personalized, encouraging, and practical preparation narrative. Use plain text paragraphs only — no markdown headers, no bullet points, no JSON.";

    public static string InterviewCoachUser1(InterviewCoachFormDataDto f) => $@"Generate interview preparation material for the following:

Role: {f.JobTitle} at {f.Company}
Interview Type: {f.InterviewType}
Job Description:
---
{Truncate(f.JobDescription, 3000)}
---

Candidate Resume Summary:
---
{Truncate(f.ResumeSummary, 8000)}
---

Return ONLY this JSON:
{{
  ""questions"": [{{ ""category"": ""<Technical|Behavioral|Situational|Role-Specific>"", ""question"": ""<question>"", ""tip"": ""<one-sentence tip>"" }}],
  ""keyStrengths"": [""<strength>""],
  ""commonPitfalls"": [""<pitfall>""],
  ""closingQuestions"": [""<question for candidate to ask>""]
}}

Rules:
- questions: 8–12, mixed per interviewType ('behavioral' → 70% Behavioral, 30% Situational; 'technical' → 70% Technical, 30% Role-Specific; 'mixed' → even spread)
- keyStrengths: 4–6 items tied to resume AND job
- commonPitfalls: 3–5 items specific to role/type
- closingQuestions: 3–5 smart, specific questions";

    public static string InterviewCoachUser2(InterviewCoachFormDataDto f, InterviewCoachResultDto r) => $@"Write a 3–4 paragraph interview preparation narrative for {f.JobTitle} at {f.Company}.
The candidate's strengths identified are: {string.Join(", ", r.KeyStrengths)}.
The interview type is: {f.InterviewType}.

Cover:
1. What to study and prioritize in the next few days before the interview
2. Mindset and confidence-building advice specific to a {f.InterviewType} interview
3. How to structure answers using their identified strengths
4. One closing piece of advice specific to the {f.Company} role

Be warm, direct, and specific. Do not use bullet points or markdown.";

    public const string SalarySystem =
        "You are an expert salary analyst specializing in tech industry compensation. Provide MONTHLY salary estimates in both USD and VND for Vietnamese market. Be accurate and realistic based on actual market data. Return ONLY valid JSON — no markdown fences, no commentary outside the JSON.";

    public static string DetermineSalaryLevel(string experience) =>
        experience.Contains("0-2") ? "Junior" :
        experience.Contains("2-5") ? "Mid-level" :
        experience.Contains("5-10") ? "Senior" :
        "Senior+";

    public static bool IsVietnam(string location)
    {
        var l = location.ToLowerInvariant();
        return l.Contains("vietnam") || l.Contains("hanoi") || l.Contains("hcm") || l.Contains("ho chi minh");
    }

    public static string SalaryUser(SalaryEstimatorFormDataDto f)
    {
        var level = DetermineSalaryLevel(f.Experience);
        var isVn = IsVietnam(f.Location);
        var locality = isVn
            ? "- Location is VIETNAM. Provide realistic VND and USD estimates for Vietnamese market.\n- Base on actual Vietnam tech salary data\n- Senior role in Vietnam: typically 40-80 million VND/month or $1,500-$3,000 USD/month\n- Mid-level: 25-40 million VND/month or $1,000-$1,500 USD/month\n- Junior: 15-25 million VND/month or $600-$1,000 USD/month\n- Remote work for US/EU companies can be 2-3x higher"
            : "- Adjust salary based on local market conditions\n- Consider cost of living and currency exchange";
        var primary = isVn ? "VND" : "USD";
        var alt = isVn ? "USD" : "VND";

        return $@"Analyze the following job profile and provide MONTHLY salary estimates for the tech market:

Job Title: {f.JobTitle} ({level} Level)
Industry: {f.Industry}
Years of Experience: {f.Experience}
Location: {f.Location}
Key Skills: {f.Skills}
Education: {f.Education}

IMPORTANT:
{locality}

Return ONLY this JSON (MONTHLY salary figures):
{{
  ""minSalary"": <number>,
  ""maxSalary"": <number>,
  ""medianSalary"": <number>,
  ""currency"": ""{primary}"",
  ""alternativeCurrency"": ""{alt}"",
  ""minSalaryAlt"": <number>,
  ""maxSalaryAlt"": <number>,
  ""medianSalaryAlt"": <number>,
  ""confidence"": ""<HIGH|MEDIUM|LOW>"",
  ""factors"": [""<skill impact>"", ""<market demand>"", ""<location advantage>""],
  ""marketInsights"": ""<2-3 sentence insight>""
}}";
    }

    public static string SalaryAnalysisUser(SalaryEstimatorFormDataDto f, SalaryEstimateDto e)
    {
        var level = DetermineSalaryLevel(f.Experience);
        var isVn = IsVietnam(f.Location);
        var salaryDisplay = isVn
            ? $"{(e.MedianSalary / 1_000_000m):F1} triệu VND/tháng (~${e.MedianSalaryAlt?.ToString("N0") ?? "N/A"}/tháng)"
            : $"${e.MedianSalary:N0}/tháng";
        var compareLine = isVn
            ? "Comparison with remote work opportunities (can earn 2-3x more)"
            : "Relocation or remote opportunities";

        return $@"You are an experienced career advisor for {f.Location}. Based on these MONTHLY salary estimates for a {level} {f.JobTitle} role:
- Median: {salaryDisplay}
- Range: {e.MinSalary:N0}-{e.MaxSalary:N0} {e.Currency}/tháng

Write 2-3 practical paragraphs about:
1. How this {level}-level salary positions the candidate in the market
2. Concrete negotiation strategies based on their {f.Experience} experience and skills: {f.Skills}
3. Realistic career growth and salary increase potential in the next 3-5 years
4. {compareLine}

Be encouraging, realistic, and specific with numbers.";
    }

    public const string GenerateTasksSystem =
        "You are an expert career coach and productivity planner. Break down a career milestone into specific, actionable daily tasks spread across a date range. Each task should be concrete and completable in 30-90 minutes. Return ONLY valid JSON — no markdown fences, no commentary outside the JSON object.";

    public static string GenerateTasksUser(string goalTitle, string milestoneTitle, string startDate, string endDate, string? context) =>
        $@"Break down this career milestone into daily actionable tasks:

Goal: {goalTitle}
Milestone: {milestoneTitle}
Date Range: {startDate} to {endDate}
{(string.IsNullOrWhiteSpace(context) ? "" : $"Additional Context: {context}")}

Return ONLY this JSON:
{{
  ""tasks"": [
    {{ ""title"": ""<specific actionable task — e.g. 'Study React useEffect hook patterns — chapter 3 of React docs'>"", ""date"": ""<YYYY-MM-DD>"" }}
  ]
}}

Rules:
- Generate 1-3 tasks per day across the ENTIRE date range
- Tasks must be SPECIFIC and ACTIONABLE — not vague like ""Study React"" but concrete like ""Build a todo app using React useState and useEffect hooks""
- Include learning tasks (read, study, watch), practice tasks (build, code, write), and review tasks (test knowledge, refactor)
- Spread tasks evenly across the date range — early dates focus on fundamentals, later dates on advanced topics
- Each task should be completable in 30-90 minutes
- Task titles should be self-explanatory — a user should know exactly what to do without extra context
- Include specific resources when relevant (e.g., ""React docs section 3"", ""LeetCode medium arrays"")";

    public const string TranslateSystem =
        "You are a professional translator. Translate the provided JSON content to the target language.\n\nRules:\n- Translate ONLY string values, never change keys or numbers\n- Preserve the exact JSON structure\n- Keep technical terms, proper nouns, company names, and programming languages untranslated\n- Return valid JSON only, no explanation or markdown";
}
