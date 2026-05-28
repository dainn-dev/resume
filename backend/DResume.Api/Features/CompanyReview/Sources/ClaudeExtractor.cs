using System.Text.Json;
using DResume.Api.Ai;
using DResume.Api.Contracts;

namespace DResume.Api.Features.CompanyReview.Sources;

internal static class ClaudeExtractor
{
    private const int MaxHtmlChars = 40000;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new FlexibleDoubleConverter(), new FlexibleIntConverter() },
    };

    public static async Task<CompanyReviewSourceResult> ExtractAsync(
        IAnthropicClient ai,
        string sourceName,
        string sourceUrl,
        string companyName,
        string cleanedHtml,
        CancellationToken ct)
    {
        if (cleanedHtml.Length > MaxHtmlChars) cleanedHtml = cleanedHtml[..MaxHtmlChars];

        var system = "You extract structured company-review data from raw HTML scraped from public review sites. " +
                     "Output ONLY a valid JSON object — no markdown fences, no commentary. " +
                     "If a field is not visible in the input, return null for it. " +
                     "CRITICAL: Never invent, duplicate, paraphrase, or fabricate reviews. " +
                     "Each review you output must correspond to a DISTINCT review entry in the HTML — " +
                     "if two reviews have identical pros/cons text, output only one (it's the same review). " +
                     "Better to return fewer high-quality reviews than to pad with copies.";

        var user = $@"Source: {sourceName}
Source URL: {sourceUrl}
Company: {companyName}

Extract company info and ALL distinct reviews from the HTML below (do NOT pad with duplicates — quality over quantity).
Use the source URL as the review link unless the HTML contains a per-review link.
Both Vietnamese and English content are valid.

Return ONLY this JSON shape:
{{
  ""info"": {{
    ""rating"": number_or_null,
    ""employeeCount"": number_or_null,
    ""industry"": string_or_null,
    ""headquarters"": string_or_null
  }},
  ""reviews"": [
    {{
      ""reviewerName"": string_or_null,
      ""reviewerPosition"": string_or_null,
      ""rating"": number_or_null,
      ""pros"": string_or_null,
      ""cons"": string_or_null,
      ""date"": string_or_null,
      ""url"": string_or_null
    }}
  ]
}}

HTML:
{cleanedHtml}";

        var raw = await ai.CompleteAsync(system, user, maxTokens: 8000, ct);
        var json = JsonExtractor.Extract(raw);
        var parsed = JsonSerializer.Deserialize<ClaudeResponse>(json, JsonOptions);
        if (parsed is null)
            return new CompanyReviewSourceResult(null, [], $"{sourceName}: Claude returned unparseable JSON.");

        var info = parsed.Info is null
            ? null
            : new CompanyInfoDto(
                Name: companyName,
                Rating: parsed.Info.Rating,
                EmployeeCount: parsed.Info.EmployeeCount,
                Industry: parsed.Info.Industry,
                Headquarters: parsed.Info.Headquarters);

        var reviews = (parsed.Reviews ?? [])
            .Select(r => new ReviewItemDto(
                Source: sourceName,
                ReviewerName: NullIfEmpty(r.ReviewerName),
                ReviewerPosition: NullIfEmpty(r.ReviewerPosition),
                Rating: r.Rating,
                Pros: NullIfEmpty(r.Pros),
                Cons: NullIfEmpty(r.Cons),
                Date: NullIfEmpty(r.Date),
                Url: NullIfEmpty(r.Url) ?? sourceUrl))
            .ToList();

        return new CompanyReviewSourceResult(info, reviews, null);
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
    }

    private sealed class ClaudeReview
    {
        public string? ReviewerName { get; set; }
        public string? ReviewerPosition { get; set; }
        public double? Rating { get; set; }
        public string? Pros { get; set; }
        public string? Cons { get; set; }
        public string? Date { get; set; }
        public string? Url { get; set; }
    }
}
