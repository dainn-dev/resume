using DResume.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Billing;

public interface IUsageService
{
    /// <summary>AI calls consumed by the user in the current UTC calendar month.</summary>
    Task<int> GetCurrentMonthUsageAsync(Guid userId, CancellationToken ct = default);

    /// <summary>
    /// Throws <see cref="PlanLimitExceededException"/> if the user has reached their plan's
    /// monthly AI-call quota. No-op for unlimited plans.
    /// </summary>
    Task EnsureAiQuotaAsync(Guid userId, CancellationToken ct = default);

    /// <summary>Atomically records one AI call for the user in the current month.</summary>
    Task ConsumeAiCallAsync(Guid userId, CancellationToken ct = default);
}

public sealed class UsageService : IUsageService
{
    private readonly ResumeDbContext _db;
    private readonly IPlanService _planService;

    public UsageService(ResumeDbContext db, IPlanService planService)
    {
        _db = db;
        _planService = planService;
    }

    private static string CurrentPeriod() => DateTime.UtcNow.ToString("yyyyMM");

    public async Task<int> GetCurrentMonthUsageAsync(Guid userId, CancellationToken ct = default)
    {
        var period = CurrentPeriod();
        var count = await _db.AiUsages
            .Where(x => x.UserId == userId && x.Period == period)
            .Select(x => (int?)x.Count)
            .FirstOrDefaultAsync(ct);
        return count ?? 0;
    }

    public async Task EnsureAiQuotaAsync(Guid userId, CancellationToken ct = default)
    {
        var plan = await _planService.GetCurrentPlanAsync(userId, ct);
        var limit = plan.Limits.MonthlyAiCalls;
        if (limit == int.MaxValue) return; // unlimited

        var used = await GetCurrentMonthUsageAsync(userId, ct);
        if (used >= limit)
        {
            throw new PlanLimitExceededException(
                $"You have reached your monthly limit of {limit} AI calls on the {plan.Name} plan. Upgrade for more.");
        }
    }

    public async Task ConsumeAiCallAsync(Guid userId, CancellationToken ct = default)
    {
        var period = CurrentPeriod();
        var now = DateTime.UtcNow;
        var id = Guid.NewGuid();

        // Atomic upsert + increment so concurrent requests (incl. across cluster nodes) can't
        // lose updates. Relies on the unique index on (UserId, Period).
        await _db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO resume.ai_usage ("Id", "UserId", "Period", "Count", "CreatedAt", "UpdatedAt")
            VALUES ({id}, {userId}, {period}, 1, {now}, {now})
            ON CONFLICT ("UserId", "Period")
            DO UPDATE SET "Count" = resume.ai_usage."Count" + 1, "UpdatedAt" = {now};
            """, ct);
    }
}
