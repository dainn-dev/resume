using System.Text.Json;
using DResume.Api.Ai;
using DResume.Api.Contracts;

namespace DResume.Api.Features.CompanyReview.Sources;

/// <summary>
/// Synthesizes company reviews from Claude's training knowledge — no scraping, no real URLs.
/// Mirrors the way Gemini surfaces forum-style reviews (Reddit, Voz, Tinhte) by drawing on
/// what the model already knows. Reviews carry no `Url` (UI hides "View original" link in that case).
/// </summary>
public sealed class ClaudeSynthesisSource : ICompanyReviewSource
{
    private readonly IAnthropicClient _ai;
    private readonly ILogger<ClaudeSynthesisSource> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new FlexibleDoubleConverter(), new FlexibleIntConverter() },
    };

    public string Name => "DResume AI";

    public ClaudeSynthesisSource(IAnthropicClient ai, ILogger<ClaudeSynthesisSource> logger)
    {
        _ai = ai;
        _logger = logger;
    }

    public async Task<CompanyReviewSourceResult> FetchAsync(string companyName, CancellationToken ct)
    {
        try
        {
            var system = "You synthesize employee/customer sentiment about a named company based on what you know from " +
                         "public discussions across forums, social media, news, and review sites — including the kind of candid " +
                         "anonymous commentary found on Reddit, Voz, Tinhte, Facebook 'tâm sự' groups, and Glassdoor's harsher reviews. " +
                         "Output ONLY a valid JSON object — no markdown fences, no commentary. " +
                         "STRICT RULES: " +
                         "(1) Only include reviews if you have actual knowledge of the company. If unknown, return empty reviews array. " +
                         "(2) Aim for ~20 reviews if you have enough material; fewer is fine if knowledge is thin. " +
                         "(3) BALANCE IS MANDATORY: roughly 40-50% of reviews MUST surface real problems — bad management, " +
                         "low pay, long hours, internal politics, biased treatment between projects, lack of career growth, " +
                         "toxic team dynamics, opaque promotion criteria, etc. Do NOT default to polished LinkedIn-style positives only. " +
                         "(4) Capture both polished views AND raw candid commentary (the kind from anonymous forum users). " +
                         "(5) Each review must be a DISTINCT viewpoint — no duplicates, no paraphrasing the same opinion. " +
                         "(6) Vary reviewer positions widely: engineer, intern, manager, BA, QA, designer, ex-employee, " +
                         "senior, junior, contractor — and reflect that different roles have different complaints. " +
                         "(7) Set url to null — these are synthesized, not scraped. " +
                         "(8) Match the company's primary market language (Vietnamese for VN companies, English for global). " +
                         "(9) Negative reviews should be SPECIFIC and useful (e.g. 'OT 2-3 đêm/tuần khi gần deadline', " +
                         "'sếp playing favorites, dự án con cưng vs con ghẻ rõ rệt') — not vague handwaving. " +
                         "(10) Goal: help the reader see REALITY, not a marketing brochure. " +
                         "(11) DATES: provide a realistic 'date' string per review like 'March 2025' / 'Q2 2024' / 'Late 2023'. " +
                         "Spread dates across the last ~2-3 years to reflect that opinions evolve. Use the review's language " +
                         "(English: 'March 2025'; Vietnamese: 'Tháng 3/2025').";

            var user = $@"Company: {companyName}

Synthesize ~20 distinct publicly-discussed reviews + company info + benefits list. REQUIREMENT: roughly half of reviews must surface real problems — be specific and candid.

For benefits: list 6-12 known benefits/perks. Mark ""highlight"": true only for STANDOUT benefits (e.g. stock options/RSU, signing bonus, premium private healthcare (PVI Gold/Bao Viet premium), 14-15th month bonus, performance bonus >30% salary, unlimited PTO, sabbatical leave, WFH stipend, education/learning budget >5M, long parental leave, daycare allowance). Standard benefits get highlight=false (e.g. mandatory BHXH/BHYT, basic 13th-month, lunch allowance, birthday gift, basic annual leave).

Output JSON:
{{
  ""info"": {{
    ""rating"": number_or_null (0-5 scale — realistic, not inflated),
    ""employeeCount"": number_or_null,
    ""industry"": string_or_null,
    ""headquarters"": string_or_null,
    ""benefits"": [
      {{
        ""name"": ""concise benefit name (e.g. 'Stock options (RSU)' / 'Lương tháng 13 + thưởng KPI')"",
        ""highlight"": true_or_false,
        ""category"": ""Compensation / Healthcare / Time-off / Learning / Lifestyle / Family""
      }}
    ]
  }},
  ""reviews"": [
    {{
      ""reviewerName"": null,
      ""reviewerPosition"": string_or_null (varied roles + seniority),
      ""rating"": number_or_null (0-5, distribute realistically including 1-3 stars),
      ""pros"": string_or_null,
      ""cons"": string_or_null (specific, candid, useful — NOT generic),
      ""date"": string (e.g. ""March 2025"" or ""Tháng 3/2025"" — spread across last 2-3 years),
      ""url"": null
    }}
  ]
}}";

            var raw = await _ai.CompleteAsync(system, user, maxTokens: 12000, ct);
            var json = JsonExtractor.Extract(raw);
            var parsed = JsonSerializer.Deserialize<ClaudeResponse>(json, JsonOptions);
            if (parsed is null)
                return new CompanyReviewSourceResult(null, [], "DResume AI returned unparseable JSON.");

            var info = parsed.Info is null
                ? null
                : new CompanyInfoDto(
                    Name: companyName,
                    Rating: parsed.Info.Rating,
                    EmployeeCount: parsed.Info.EmployeeCount,
                    Industry: parsed.Info.Industry,
                    Headquarters: parsed.Info.Headquarters,
                    Benefits: parsed.Info.Benefits?
                        .Where(b => !string.IsNullOrWhiteSpace(b.Name))
                        .Select(b => new BenefitDto(b.Name!.Trim(), b.Highlight ?? false, NullIfEmpty(b.Category)))
                        .ToList());

            var reviews = (parsed.Reviews ?? [])
                .Where(r => !string.IsNullOrWhiteSpace(r.Pros) || !string.IsNullOrWhiteSpace(r.Cons))
                .Select(r => new ReviewItemDto(
                    Source: Name,
                    ReviewerName: null,
                    ReviewerPosition: NullIfEmpty(r.ReviewerPosition),
                    Rating: r.Rating,
                    Pros: NullIfEmpty(r.Pros),
                    Cons: NullIfEmpty(r.Cons),
                    Date: NullIfEmpty(r.Date),
                    Url: null))
                .ToList();

            if (reviews.Count == 0 && info is null)
                return new CompanyReviewSourceResult(null, [], "DResume AI has no public knowledge of this company.");

            return new CompanyReviewSourceResult(info, reviews, null);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Claude synthesis failed for {Company}", companyName);
            return new CompanyReviewSourceResult(null, [], ex.Message);
        }
    }

    private static string? NullIfEmpty(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private sealed class ClaudeResponse
    {
        public ClaudeInfo? Info { get; set; }
        public List<ClaudeReview>? Reviews { get; set; }
    }

    private sealed class ClaudeInfo
    {
        public double? Rating { get; set; }
        public int? EmployeeCount { get; set; }
        public string? Industry { get; set; }
        public string? Headquarters { get; set; }
        public List<ClaudeBenefit>? Benefits { get; set; }
    }

    private sealed class ClaudeBenefit
    {
        public string? Name { get; set; }
        public bool? Highlight { get; set; }
        public string? Category { get; set; }
    }

    private sealed class ClaudeReview
    {
        public string? ReviewerPosition { get; set; }
        public double? Rating { get; set; }
        public string? Pros { get; set; }
        public string? Cons { get; set; }
        public string? Date { get; set; }
    }
}
