using DainnStripe.Data;
using DainnStripe.Entities;
using DainnUser.Infrastructure.Data;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DResume.Api.Billing;

public interface IStripePriceManager
{
    Task<List<StripePriceView>> ListPricesAsync(PlanCode code, CancellationToken ct = default);
    Task<StripePriceView> CreateNewPriceAsync(PlanCode code, long newUnitAmountCents, CancellationToken ct = default);
    Task ArchivePriceAsync(string stripePriceId, CancellationToken ct = default);
    Task SetDefaultPriceAsync(PlanCode code, string stripePriceId, CancellationToken ct = default);
    Task<MigrationResult> MigrateSubscriptionsToDefaultAsync(PlanCode code, CancellationToken ct = default);
    Task<int> CountSubscriptionsOnOldPricesAsync(PlanCode code, CancellationToken ct = default);
}

public sealed record MigrationResult(int MigratedCount, int FailedCount, List<string> FailedSubscriptionIds);

public sealed record StripePriceView(
    string StripePriceId,
    long UnitAmountCents,
    string Currency,
    string? LookupKey,
    bool Active,
    bool IsDefault,
    DateTime Created);

public sealed class StripePriceManager : IStripePriceManager
{
    private readonly IServiceProvider _sp;
    private readonly ResumeDbContext _resumeDb;
    private readonly DainnUserDbContext _userDb;
    private readonly IPlanCatalogService _plans;
    private readonly IBillingNotifier _notifier;
    private readonly ILogger<StripePriceManager> _logger;

    // DainnStripeDbContext is only registered when Stripe is enabled. Resolve it lazily so
    // this manager can be constructed even with Stripe off (all its methods are Stripe-only
    // and will throw a clean error below if invoked while disabled).
    private DainnStripeDbContext _stripeDb => _sp.GetService<DainnStripeDbContext>()
        ?? throw new InvalidOperationException("Card payments are disabled (Stripe is not configured).");

    public StripePriceManager(
        IServiceProvider sp,
        ResumeDbContext resumeDb,
        DainnUserDbContext userDb,
        IPlanCatalogService plans,
        IBillingNotifier notifier,
        ILogger<StripePriceManager> logger)
    {
        _sp = sp;
        _resumeDb = resumeDb;
        _userDb = userDb;
        _plans = plans;
        _notifier = notifier;
        _logger = logger;
    }

    public async Task<List<StripePriceView>> ListPricesAsync(PlanCode code, CancellationToken ct = default)
    {
        var plan = await _plans.GetRecordAsync(code, ct)
            ?? throw new KeyNotFoundException($"Plan {code} not found.");

        // Fetch the corresponding Stripe product (by lookup key in our local stripe DB)
        var product = await _stripeDb.Set<DainnStripeProduct>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.LookupKey == plan.LookupKey, ct);
        if (product is null) return new();

        // Also pull prices from Stripe live to catch anything not yet mirrored.
        var stripePrices = new List<Stripe.Price>();
        try
        {
            var listed = await new Stripe.PriceService().ListAsync(
                new Stripe.PriceListOptions { Product = product.StripeProductId, Limit = 100, Active = null },
                cancellationToken: ct);
            stripePrices.AddRange(listed.Data);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to list Stripe prices live; falling back to local mirror.");
        }

        var seen = new HashSet<string>();
        var views = new List<StripePriceView>();
        foreach (var sp in stripePrices)
        {
            if (sp.Recurring is null || sp.Recurring.Interval != "month") continue; // only show monthly
            seen.Add(sp.Id);
            views.Add(new StripePriceView(
                StripePriceId: sp.Id,
                UnitAmountCents: sp.UnitAmount ?? 0,
                Currency: sp.Currency,
                LookupKey: sp.LookupKey,
                Active: sp.Active,
                IsDefault: sp.Id == plan.ActiveStripePriceId,
                Created: sp.Created));
        }

        // Append any local mirrored prices not present in the live fetch (e.g. if live failed)
        var local = await _stripeDb.Set<DainnStripePrice>()
            .AsNoTracking()
            .Where(p => p.ProductId == product.Id)
            .ToListAsync(ct);
        foreach (var lp in local)
        {
            if (string.IsNullOrEmpty(lp.StripePriceId) || seen.Contains(lp.StripePriceId)) continue;
            views.Add(new StripePriceView(
                StripePriceId: lp.StripePriceId,
                UnitAmountCents: lp.UnitAmount,
                Currency: lp.Currency ?? "usd",
                LookupKey: lp.LookupKey,
                Active: lp.Active,
                IsDefault: lp.StripePriceId == plan.ActiveStripePriceId,
                Created: lp.CreatedAt));
        }

        return views.OrderByDescending(v => v.Created).ToList();
    }

    public async Task<StripePriceView> CreateNewPriceAsync(PlanCode code, long newUnitAmountCents, CancellationToken ct = default)
    {
        if (newUnitAmountCents <= 0) throw new ArgumentException("Price must be positive.");

        var plan = await _plans.GetRecordAsync(code, ct)
            ?? throw new KeyNotFoundException($"Plan {code} not found.");

        var product = await _stripeDb.Set<DainnStripeProduct>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.LookupKey == plan.LookupKey, ct)
            ?? throw new InvalidOperationException($"Stripe product for {plan.LookupKey} not yet seeded. Restart backend or run StripeCatalogSeeder.");

        var newLookupKey = $"{plan.LookupKey}_{newUnitAmountCents}_{DateTime.UtcNow:yyyyMMddHHmmss}";
        var stripePrice = await new Stripe.PriceService().CreateAsync(new Stripe.PriceCreateOptions
        {
            Product = product.StripeProductId,
            UnitAmount = newUnitAmountCents,
            Currency = plan.Currency,
            Recurring = new Stripe.PriceRecurringOptions { Interval = "month", IntervalCount = 1 },
            LookupKey = newLookupKey,
            Metadata = new Dictionary<string, string> { ["plan_code"] = plan.Code.ToString() },
            Active = true,
        }, cancellationToken: ct);

        await _plans.SetPriceAsync(code, newUnitAmountCents, stripePrice.Id, ct);

        return new StripePriceView(
            stripePrice.Id, newUnitAmountCents, stripePrice.Currency, newLookupKey, true, true, stripePrice.Created);
    }

    public async Task ArchivePriceAsync(string stripePriceId, CancellationToken ct = default)
    {
        await new Stripe.PriceService().UpdateAsync(stripePriceId,
            new Stripe.PriceUpdateOptions { Active = false },
            cancellationToken: ct);

        // Mirror in local DB if present
        var local = await _stripeDb.Set<DainnStripePrice>()
            .FirstOrDefaultAsync(p => p.StripePriceId == stripePriceId, ct);
        if (local is not null)
        {
            local.Active = false;
            await _stripeDb.SaveChangesAsync(ct);
        }
    }

    public async Task SetDefaultPriceAsync(PlanCode code, string stripePriceId, CancellationToken ct = default)
    {
        var stripePrice = await new Stripe.PriceService().GetAsync(stripePriceId, cancellationToken: ct);
        if (!stripePrice.Active)
            throw new InvalidOperationException("Cannot set an archived price as default. Reactivate it first.");
        await _plans.SetPriceAsync(code, stripePrice.UnitAmount ?? 0, stripePriceId, ct);
    }

    public async Task<int> CountSubscriptionsOnOldPricesAsync(PlanCode code, CancellationToken ct = default)
    {
        var oldPriceIds = await GetOldPriceIdsAsync(code, ct);
        if (oldPriceIds.Count == 0) return 0;
        int total = 0;
        foreach (var priceId in oldPriceIds)
        {
            try
            {
                var subs = await new Stripe.SubscriptionService().ListAsync(
                    new Stripe.SubscriptionListOptions { Price = priceId, Status = "active", Limit = 100 },
                    cancellationToken: ct);
                total += subs.Data.Count;
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Failed to count subs for price {Price}", priceId); }
        }
        return total;
    }

    public async Task<MigrationResult> MigrateSubscriptionsToDefaultAsync(PlanCode code, CancellationToken ct = default)
    {
        var plan = await _plans.GetRecordAsync(code, ct)
            ?? throw new KeyNotFoundException($"Plan {code} not found.");
        if (string.IsNullOrEmpty(plan.ActiveStripePriceId))
            throw new InvalidOperationException("Plan has no default Stripe price set. Set one before migrating.");

        var oldPriceIds = await GetOldPriceIdsAsync(code, ct);
        if (oldPriceIds.Count == 0) return new MigrationResult(0, 0, new());

        var defaultPrice = await new Stripe.PriceService().GetAsync(plan.ActiveStripePriceId, cancellationToken: ct);
        var newCents = defaultPrice.UnitAmount ?? plan.MonthlyPriceCents;

        int migrated = 0;
        int failed = 0;
        var failedIds = new List<string>();
        var subService = new Stripe.SubscriptionService();

        foreach (var oldPriceId in oldPriceIds)
        {
            var subs = await subService.ListAsync(
                new Stripe.SubscriptionListOptions { Price = oldPriceId, Status = "active", Limit = 100 },
                cancellationToken: ct);

            // Lookup old price unit amount for the email body
            var oldPrice = await new Stripe.PriceService().GetAsync(oldPriceId, cancellationToken: ct);
            var oldCents = oldPrice.UnitAmount ?? 0;

            foreach (var sub in subs.Data)
            {
                var subItem = sub.Items?.Data?.FirstOrDefault(i => i.Price?.Id == oldPriceId);
                if (subItem is null) continue;
                try
                {
                    await subService.UpdateAsync(sub.Id, new Stripe.SubscriptionUpdateOptions
                    {
                        Items = new List<Stripe.SubscriptionItemOptions>
                        {
                            new() { Id = subItem.Id, Price = plan.ActiveStripePriceId },
                        },
                        ProrationBehavior = "none", // new price takes effect at next renewal, no immediate charge
                    }, cancellationToken: ct);
                    migrated++;

                    // Notify user
                    await NotifyUserOfPriceChangeAsync(sub, plan, oldCents, newCents, ct);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to migrate sub {SubId}", sub.Id);
                    failed++;
                    failedIds.Add(sub.Id);
                }
            }
        }

        return new MigrationResult(migrated, failed, failedIds);
    }

    private async Task<List<string>> GetOldPriceIdsAsync(PlanCode code, CancellationToken ct)
    {
        var plan = await _plans.GetRecordAsync(code, ct);
        if (plan is null || string.IsNullOrEmpty(plan.ActiveStripePriceId)) return new();

        var product = await _stripeDb.Set<DainnStripeProduct>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.LookupKey == plan.LookupKey, ct);
        if (product is null) return new();

        var allPrices = await new Stripe.PriceService().ListAsync(
            new Stripe.PriceListOptions { Product = product.StripeProductId, Limit = 100, Active = null },
            cancellationToken: ct);

        return allPrices.Data
            .Where(p => p.Recurring?.Interval == "month" && p.Id != plan.ActiveStripePriceId)
            .Select(p => p.Id)
            .ToList();
    }

    private async Task NotifyUserOfPriceChangeAsync(Stripe.Subscription sub, PlanRecord plan, long oldCents, long newCents, CancellationToken ct)
    {
        try
        {
            // Resolve user by customer ID via our user_subscriptions table
            var userSub = await _resumeDb.UserSubscriptions
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.StripeCustomerId == sub.CustomerId, ct);
            if (userSub is null) return;
            var user = await _userDb.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userSub.UserId, ct);
            if (user is null || string.IsNullOrWhiteSpace(user.Email)) return;

            var periodEnd = sub.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;
            await _notifier.SendPriceChangeScheduledAsync(
                user.Email,
                string.IsNullOrWhiteSpace(user.Username) ? "there" : user.Username,
                PlanCatalog.Get(plan.Code),
                oldCents, newCents,
                periodEnd,
                ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send price-change email for sub {SubId}", sub.Id);
        }
    }
}
