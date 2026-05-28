using System.Text.Json;
using DResume.Api.Ai;
using DResume.Api.Billing;
using DResume.Api.Contracts;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using DResume.Api.Features.CompanyReview.Sources;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Features.CompanyReview;

public interface ICompanyReviewService
{
    Task<CompanyReviewResponse> SearchAsync(string companyName, Guid userId, CancellationToken ct);
    Task<TopTechResponse> GetTopTechCompaniesAsync(CancellationToken ct);
}

public sealed class CompanyReviewService : ICompanyReviewService
{
    private readonly ResumeDbContext _db;
    private readonly IEnumerable<ICompanyReviewSource> _sources;
    private readonly IPlanService _plans;
    private readonly IAnthropicClient _ai;
    private readonly ILogger<CompanyReviewService> _logger;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromHours(24);
    private static readonly TimeSpan TopTechCacheTtl = TimeSpan.FromDays(7);
    private const string TopTechVnKey = "__top_tech_vn__";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        Converters =
        {
            new Sources.FlexibleDoubleConverter(),
            new Sources.FlexibleIntConverter(),
        },
    };

    public CompanyReviewService(
        ResumeDbContext db,
        IEnumerable<ICompanyReviewSource> sources,
        IPlanService plans,
        IAnthropicClient ai,
        ILogger<CompanyReviewService> logger)
    {
        _db = db;
        _sources = sources;
        _plans = plans;
        _ai = ai;
        _logger = logger;
    }

    public async Task<CompanyReviewResponse> SearchAsync(string companyName, Guid userId, CancellationToken ct)
    {
        var trimmed = companyName.Trim();
        if (trimmed.Length == 0) throw new ArgumentException("Company name is required.");

        var companyKey = trimmed.ToLowerInvariant();
        var now = DateTime.UtcNow;

        var cached = await _db.CompanyReviewCaches
            .FirstOrDefaultAsync(c => c.CompanyKey == companyKey, ct);

        CachedPayload merged;
        bool fromCache;

        if (cached is not null && cached.ExpiresAt > now)
        {
            merged = JsonSerializer.Deserialize<CachedPayload>(cached.DataJson, JsonOptions)
                     ?? new CachedPayload(new CompanyInfoDto(trimmed, null, null, null, null), [], []);
            fromCache = true;
        }
        else
        {
            merged = await FetchFromAllSourcesAsync(trimmed, ct);
            fromCache = false;

            var hasAnyData = merged.Reviews.Count > 0
                || merged.Info.Rating is not null
                || merged.Info.EmployeeCount is not null
                || !string.IsNullOrWhiteSpace(merged.Info.Industry)
                || !string.IsNullOrWhiteSpace(merged.Info.Headquarters);

            if (hasAnyData)
            {
                var json = JsonSerializer.Serialize(merged, JsonOptions);
                if (cached is null)
                {
                    _db.CompanyReviewCaches.Add(new CompanyReviewCacheRecord
                    {
                        CompanyKey = companyKey,
                        DataJson = json,
                        FetchedAt = now,
                        ExpiresAt = now + CacheTtl,
                    });
                }
                else
                {
                    cached.DataJson = json;
                    cached.FetchedAt = now;
                    cached.ExpiresAt = now + CacheTtl;
                }

                try
                {
                    await _db.SaveChangesAsync(ct);
                }
                catch (DbUpdateException ex)
                {
                    _logger.LogWarning(ex, "Failed to persist company review cache for {Key}", companyKey);
                }
            }
            else if (cached is not null)
            {
                _db.CompanyReviewCaches.Remove(cached);
                try { await _db.SaveChangesAsync(ct); } catch (DbUpdateException) { /* best effort */ }
            }
        }

        var plan = await _plans.GetCurrentPlanAsync(userId, ct);
        var limit = plan.Code == PlanCode.Free ? 10 : 100;
        var totalAvailable = merged.Reviews.Count;
        var limitedReviews = merged.Reviews.Take(limit).ToList();

        return new CompanyReviewResponse(
            Info: merged.Info,
            Reviews: limitedReviews,
            Sources: merged.Sources,
            FromCache: fromCache,
            LimitApplied: limit,
            TotalAvailable: totalAvailable);
    }

    private async Task<CachedPayload> FetchFromAllSourcesAsync(string companyName, CancellationToken ct)
    {
        var tasks = _sources
            .Select(async source =>
            {
                try
                {
                    var result = await source.FetchAsync(companyName, ct);
                    return (source.Name, result);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Source {Source} threw unhandled exception", source.Name);
                    return (source.Name, new CompanyReviewSourceResult(null, [], ex.Message));
                }
            })
            .ToList();

        var results = await Task.WhenAll(tasks);

        var allReviews = new List<ReviewItemDto>();
        var statuses = new List<SourceStatusDto>();
        CompanyInfoDto? bestInfo = null;
        double? bestRating = null;
        int? bestEmployees = null;
        string? bestIndustry = null;
        string? bestHq = null;
        List<BenefitDto>? bestBenefits = null;

        foreach (var (sourceName, result) in results)
        {
            var status = result.Error is null ? "ok" : (result.Error.Contains("blocked", StringComparison.OrdinalIgnoreCase) ? "blocked" : "error");
            statuses.Add(new SourceStatusDto(sourceName, status, result.Reviews.Count, result.Error));
            allReviews.AddRange(result.Reviews);

            if (result.Info is not null)
            {
                bestInfo ??= result.Info;
                bestRating ??= result.Info.Rating;
                bestEmployees ??= result.Info.EmployeeCount;
                bestIndustry ??= result.Info.Industry;
                bestHq ??= result.Info.Headquarters;
                if (bestBenefits is null && result.Info.Benefits is { Count: > 0 })
                    bestBenefits = result.Info.Benefits;
            }
        }

        var dedupedReviews = allReviews
            .Where(r => !string.IsNullOrWhiteSpace(r.Pros) || !string.IsNullOrWhiteSpace(r.Cons))
            .GroupBy(r => string.Join("|", r.Source, NormalizeForDedup(r.Pros), NormalizeForDedup(r.Cons)))
            .Select(g => g.First())
            .Take(100)
            .ToList();

        var reviewRatings = dedupedReviews
            .Where(r => r.Rating.HasValue)
            .Select(r => r.Rating!.Value)
            .ToList();
        double? computedRating = reviewRatings.Count > 0
            ? Math.Round(reviewRatings.Average(), 1)
            : null;

        var info = new CompanyInfoDto(
            Name: companyName,
            Rating: computedRating ?? bestRating,
            EmployeeCount: bestEmployees,
            Industry: bestIndustry,
            Headquarters: bestHq,
            Benefits: bestBenefits);

        return new CachedPayload(info, dedupedReviews, statuses);
    }

    private static string NormalizeForDedup(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return "";
        return new string(s.Trim().ToLowerInvariant().Where(c => !char.IsWhiteSpace(c) && c != '.' && c != ',').ToArray());
    }

    public async Task<TopTechResponse> GetTopTechCompaniesAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var cached = await _db.CompanyReviewCaches.FirstOrDefaultAsync(c => c.CompanyKey == TopTechVnKey, ct);

        if (cached is not null && cached.ExpiresAt > now)
        {
            var fromCachePayload = JsonSerializer.Deserialize<TopTechPayload>(cached.DataJson, JsonOptions);
            if (fromCachePayload is not null)
                return new TopTechResponse(fromCachePayload.Companies, "Vietnam", FromCache: true);
        }

        var fresh = await GenerateTopTechFromClaudeAsync(ct);
        var payload = new TopTechPayload(fresh);
        var json = JsonSerializer.Serialize(payload, JsonOptions);

        if (cached is null)
        {
            _db.CompanyReviewCaches.Add(new CompanyReviewCacheRecord
            {
                CompanyKey = TopTechVnKey,
                DataJson = json,
                FetchedAt = now,
                ExpiresAt = now + TopTechCacheTtl,
            });
        }
        else
        {
            cached.DataJson = json;
            cached.FetchedAt = now;
            cached.ExpiresAt = now + TopTechCacheTtl;
        }

        try { await _db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) { _logger.LogWarning(ex, "Failed to persist top-tech cache"); }

        return new TopTechResponse(fresh, "Vietnam", FromCache: false);
    }

    private async Task<List<TopTechCompanyDto>> GenerateTopTechFromClaudeAsync(CancellationToken ct)
    {
        const string system = "You curate ranked lists of top tech companies based on widely-recognized public information " +
                              "about compensation, benefits, employee satisfaction, and workplace quality. " +
                              "Output ONLY a valid JSON object — no markdown fences, no commentary. " +
                              "Be factual and conservative — only include companies with strong, verifiable reputations.";

        const string user = @"List the TOP 10 tech companies in Vietnam known for the BEST compensation, bonuses, and benefits.
Criteria: above-market salary, generous bonus (e.g. 13th month, performance), strong perks (insurance, allowances, training), good work-life balance, employee satisfaction.

Include a mix of: VN-grown unicorns/scale-ups, VN R&D centers of multinationals, leading local product/outsourcing companies.

Output JSON ONLY:
{
  ""companies"": [
    {
      ""name"": ""Company Name"",
      ""rating"": number (0-5 realistic estimate),
      ""industry"": ""e.g. Fintech / E-commerce / Gaming / R&D / Software services"",
      ""headquarters"": ""City, Vietnam"",
      ""summary"": ""1-2 sentence why they're known for great comp & benefits"",
      ""perks"": [""concrete perk 1"", ""concrete perk 2"", ""concrete perk 3""]
    }
  ]
}

Order from best to good. Exactly 10 companies.";

        var raw = await _ai.CompleteAsync(system, user, maxTokens: 8000, ct);
        var json = JsonExtractor.Extract(raw);
        var parsed = JsonSerializer.Deserialize<TopTechClaudeResponse>(json, JsonOptions);
        if (parsed?.Companies is null) return [];

        return parsed.Companies
            .Where(c => !string.IsNullOrWhiteSpace(c.Name))
            .Select(c => new TopTechCompanyDto(
                Name: c.Name!.Trim(),
                Rating: c.Rating,
                Industry: string.IsNullOrWhiteSpace(c.Industry) ? null : c.Industry.Trim(),
                Headquarters: string.IsNullOrWhiteSpace(c.Headquarters) ? null : c.Headquarters.Trim(),
                Summary: string.IsNullOrWhiteSpace(c.Summary) ? null : c.Summary.Trim(),
                Perks: c.Perks?.Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => p.Trim()).ToList() ?? []))
            .Take(10)
            .ToList();
    }

    private sealed record CachedPayload(
        CompanyInfoDto Info,
        List<ReviewItemDto> Reviews,
        List<SourceStatusDto> Sources);

    private sealed record TopTechPayload(List<TopTechCompanyDto> Companies);

    private sealed class TopTechClaudeResponse
    {
        public List<TopTechCompanyEntry>? Companies { get; set; }
    }

    private sealed class TopTechCompanyEntry
    {
        public string? Name { get; set; }
        public double? Rating { get; set; }
        public string? Industry { get; set; }
        public string? Headquarters { get; set; }
        public string? Summary { get; set; }
        public List<string>? Perks { get; set; }
    }
}
