using DResume.Api.Common;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Billing;

public interface IPlanService
{
    Task<UserSubscription> GetOrCreateAsync(Guid userId, CancellationToken ct = default);
    Task<PlanDefinition> GetCurrentPlanAsync(Guid userId, CancellationToken ct = default);
    Task<UserSubscription> SetPlanAsync(
        Guid userId,
        PlanCode plan,
        string? stripeCustomerId,
        string? stripeSubscriptionId,
        string status,
        bool cancelAtPeriodEnd,
        DateTime? currentPeriodEnd,
        CancellationToken ct = default);
    Task<UserSubscription?> FindByStripeSubscriptionAsync(string subscriptionId, CancellationToken ct = default);
    bool IsAdmin();
}

public sealed class PlanService : IPlanService
{
    private readonly ResumeDbContext _db;
    private readonly ICurrentUser _current;
    private readonly HashSet<string> _adminEmails;

    public PlanService(ResumeDbContext db, ICurrentUser current, IConfiguration config)
    {
        _db = db;
        _current = current;
        _adminEmails = config.GetSection("Admin:Emails")
            .Get<string[]>()
            ?.ToHashSet(StringComparer.OrdinalIgnoreCase)
            ?? [];
    }

    public bool IsAdmin() =>
        _current.Email is not null && _adminEmails.Contains(_current.Email);

    public async Task<UserSubscription> GetOrCreateAsync(Guid userId, CancellationToken ct = default)
    {
        var sub = await _db.UserSubscriptions.FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (sub is not null) return sub;
        sub = new UserSubscription { UserId = userId, PlanCode = PlanCode.Free, Status = "active" };
        _db.UserSubscriptions.Add(sub);
        try
        {
            await _db.SaveChangesAsync(ct);
            return sub;
        }
        catch (DbUpdateException)
        {
            // Race: another concurrent call inserted the row first. Detach our duplicate and re-fetch.
            _db.Entry(sub).State = EntityState.Detached;
            return await _db.UserSubscriptions.FirstAsync(x => x.UserId == userId, ct);
        }
    }

    public async Task<PlanDefinition> GetCurrentPlanAsync(Guid userId, CancellationToken ct = default)
    {
        if (IsAdmin()) return PlanCatalog.Enterprise;

        var sub = await GetOrCreateAsync(userId, ct);
        var isActive = sub.Status is "active" or "trialing";
        return isActive ? PlanCatalog.Get(sub.PlanCode) : PlanCatalog.Free;
    }

    public async Task<UserSubscription> SetPlanAsync(
        Guid userId,
        PlanCode plan,
        string? stripeCustomerId,
        string? stripeSubscriptionId,
        string status,
        bool cancelAtPeriodEnd,
        DateTime? currentPeriodEnd,
        CancellationToken ct = default)
    {
        var sub = await GetOrCreateAsync(userId, ct);
        sub.PlanCode = plan;
        sub.Status = status;
        sub.CancelAtPeriodEnd = cancelAtPeriodEnd;
        sub.CurrentPeriodEnd = currentPeriodEnd;
        if (!string.IsNullOrEmpty(stripeCustomerId)) sub.StripeCustomerId = stripeCustomerId;
        if (!string.IsNullOrEmpty(stripeSubscriptionId)) sub.StripeSubscriptionId = stripeSubscriptionId;
        sub.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return sub;
    }

    public Task<UserSubscription?> FindByStripeSubscriptionAsync(string subscriptionId, CancellationToken ct = default) =>
        _db.UserSubscriptions.FirstOrDefaultAsync(x => x.StripeSubscriptionId == subscriptionId, ct);
}
