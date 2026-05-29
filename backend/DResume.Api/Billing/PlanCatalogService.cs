using DResume.Api.Data;
using DResume.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace DResume.Api.Billing;

public interface IPlanCatalogService
{
    Task<IReadOnlyList<PlanDefinition>> GetAllAsync(CancellationToken ct = default);
    Task<PlanDefinition> GetAsync(PlanCode code, CancellationToken ct = default);
    Task<PlanDefinition?> GetByLookupKeyAsync(string lookupKey, CancellationToken ct = default);
    Task<PlanDefinition> UpdatePlanAsync(PlanCode code, UpdatePlanRequest req, CancellationToken ct = default);
    Task<PlanRecord> SeedIfEmptyAsync(CancellationToken ct = default);
    Task<PlanRecord?> GetRecordAsync(PlanCode code, CancellationToken ct = default);
    Task<PlanRecord> SetActiveStripePriceAsync(PlanCode code, string? stripePriceId, CancellationToken ct = default);
    Task<PlanRecord> SetPriceAsync(PlanCode code, long newCents, string newStripePriceId, CancellationToken ct = default);
    void InvalidateCache();
}

public sealed record UpdatePlanRequest(
    string? Name,
    string? Description,
    int? MaxResumes,
    int? MonthlyAiCalls,
    bool? JobMatchEnabled,
    bool? CoverLetterEnabled,
    bool? CareerCoachEnabled,
    bool? InterviewCoachEnabled,
    bool? SalaryEstimatorEnabled,
    bool? CalendarEnabled,
    bool? CompanyReviewEnabled,
    bool? PriorityQueue,
    long? MonthlyPriceVnd);

public sealed class PlanCatalogService : IPlanCatalogService
{
    private readonly ResumeDbContext _db;
    private readonly IMemoryCache _cache;
    private const string CacheKey = "plan_catalog_all";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    public PlanCatalogService(ResumeDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<IReadOnlyList<PlanDefinition>> GetAllAsync(CancellationToken ct = default)
    {
        if (_cache.TryGetValue(CacheKey, out IReadOnlyList<PlanDefinition>? cached) && cached is not null)
            return cached;

        var records = await _db.Plans.AsNoTracking().OrderBy(p => p.Code).ToListAsync(ct);
        if (records.Count == 0)
        {
            // First-time bootstrap: seed from hardcoded defaults
            await SeedIfEmptyAsync(ct);
            records = await _db.Plans.AsNoTracking().OrderBy(p => p.Code).ToListAsync(ct);
        }
        var list = records.Select(ToDefinition).ToList().AsReadOnly();
        _cache.Set(CacheKey, (IReadOnlyList<PlanDefinition>)list, CacheTtl);
        return list;
    }

    public async Task<PlanDefinition> GetAsync(PlanCode code, CancellationToken ct = default)
    {
        var all = await GetAllAsync(ct);
        return all.FirstOrDefault(p => p.Code == code) ?? PlanCatalog.Get(code);
    }

    public async Task<PlanDefinition?> GetByLookupKeyAsync(string lookupKey, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(lookupKey)) return null;
        var all = await GetAllAsync(ct);
        var match = all.FirstOrDefault(p => p.LookupKey == lookupKey);
        if (match is not null) return match;
        // Fallback to legacy lookup keys for backwards compat (old Stripe subs)
        return PlanCatalog.GetByLookupKey(lookupKey);
    }

    public async Task<PlanRecord?> GetRecordAsync(PlanCode code, CancellationToken ct = default) =>
        await _db.Plans.FirstOrDefaultAsync(p => p.Code == code, ct);

    public async Task<PlanDefinition> UpdatePlanAsync(PlanCode code, UpdatePlanRequest req, CancellationToken ct = default)
    {
        var record = await _db.Plans.FirstOrDefaultAsync(p => p.Code == code, ct)
            ?? throw new KeyNotFoundException($"Plan {code} not found.");

        if (req.Name is not null) record.Name = req.Name.Trim();
        if (req.Description is not null) record.Description = req.Description.Trim();
        if (req.MaxResumes.HasValue) record.MaxResumes = req.MaxResumes.Value;
        if (req.MonthlyAiCalls.HasValue) record.MonthlyAiCalls = req.MonthlyAiCalls.Value;
        if (req.JobMatchEnabled.HasValue) record.JobMatchEnabled = req.JobMatchEnabled.Value;
        if (req.CoverLetterEnabled.HasValue) record.CoverLetterEnabled = req.CoverLetterEnabled.Value;
        if (req.CareerCoachEnabled.HasValue) record.CareerCoachEnabled = req.CareerCoachEnabled.Value;
        if (req.InterviewCoachEnabled.HasValue) record.InterviewCoachEnabled = req.InterviewCoachEnabled.Value;
        if (req.SalaryEstimatorEnabled.HasValue) record.SalaryEstimatorEnabled = req.SalaryEstimatorEnabled.Value;
        if (req.CalendarEnabled.HasValue) record.CalendarEnabled = req.CalendarEnabled.Value;
        if (req.CompanyReviewEnabled.HasValue) record.CompanyReviewEnabled = req.CompanyReviewEnabled.Value;
        if (req.PriorityQueue.HasValue) record.PriorityQueue = req.PriorityQueue.Value;
        if (req.MonthlyPriceVnd.HasValue) record.MonthlyPriceVnd = req.MonthlyPriceVnd.Value;
        record.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        InvalidateCache();
        return ToDefinition(record);
    }

    public async Task<PlanRecord> SetActiveStripePriceAsync(PlanCode code, string? stripePriceId, CancellationToken ct = default)
    {
        var record = await _db.Plans.FirstOrDefaultAsync(p => p.Code == code, ct)
            ?? throw new KeyNotFoundException($"Plan {code} not found.");
        record.ActiveStripePriceId = stripePriceId;
        record.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        InvalidateCache();
        return record;
    }

    public async Task<PlanRecord> SetPriceAsync(PlanCode code, long newCents, string newStripePriceId, CancellationToken ct = default)
    {
        var record = await _db.Plans.FirstOrDefaultAsync(p => p.Code == code, ct)
            ?? throw new KeyNotFoundException($"Plan {code} not found.");
        record.MonthlyPriceCents = newCents;
        record.ActiveStripePriceId = newStripePriceId;
        record.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        InvalidateCache();
        return record;
    }

    public async Task<PlanRecord> SeedIfEmptyAsync(CancellationToken ct = default)
    {
        if (await _db.Plans.AnyAsync(ct)) return await _db.Plans.FirstAsync(ct);

        foreach (var p in PlanCatalog.All)
        {
            _db.Plans.Add(new PlanRecord
            {
                Code = p.Code,
                LookupKey = p.LookupKey,
                Name = p.Name,
                Description = p.Description,
                MonthlyPriceCents = p.MonthlyPriceCents,
                Currency = p.Currency,
                MonthlyPriceVnd = p.MonthlyPriceVnd,
                MaxResumes = p.Limits.MaxResumes,
                MonthlyAiCalls = p.Limits.MonthlyAiCalls,
                JobMatchEnabled = p.Limits.JobMatchEnabled,
                CoverLetterEnabled = p.Limits.CoverLetterEnabled,
                CareerCoachEnabled = p.Limits.CareerCoachEnabled,
                InterviewCoachEnabled = p.Limits.InterviewCoachEnabled,
                SalaryEstimatorEnabled = p.Limits.SalaryEstimatorEnabled,
                CalendarEnabled = p.Limits.CalendarEnabled,
                CompanyReviewEnabled = p.Limits.CompanyReviewEnabled,
                PriorityQueue = p.Limits.PriorityQueue,
            });
        }
        await _db.SaveChangesAsync(ct);
        InvalidateCache();
        return await _db.Plans.FirstAsync(ct);
    }

    public void InvalidateCache() => _cache.Remove(CacheKey);

    private static PlanDefinition ToDefinition(PlanRecord r) => new(
        r.Code,
        r.LookupKey,
        r.Name,
        r.Description,
        r.MonthlyPriceCents,
        r.Currency,
        new PlanLimits(
            r.MaxResumes,
            r.MonthlyAiCalls,
            r.JobMatchEnabled,
            r.CoverLetterEnabled,
            r.CareerCoachEnabled,
            r.InterviewCoachEnabled,
            r.SalaryEstimatorEnabled,
            r.CalendarEnabled,
            r.CompanyReviewEnabled,
            r.PriorityQueue),
        r.MonthlyPriceVnd);
}
