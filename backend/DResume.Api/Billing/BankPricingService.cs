using DResume.Api.Data;
using DResume.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace DResume.Api.Billing;

public interface IBankPricingService
{
    /// <summary>Active tiers for a plan, ordered by Months. Cached.</summary>
    Task<IReadOnlyList<BankPricingTier>> GetActiveTiersAsync(PlanCode code, CancellationToken ct = default);
    /// <summary>All tiers (incl. inactive) for a plan, ordered by Months — for admin.</summary>
    Task<IReadOnlyList<BankPricingTier>> GetAllTiersAsync(PlanCode code, CancellationToken ct = default);
    /// <summary>Discount % for a given duration, or null if no active tier matches.</summary>
    Task<int?> GetDiscountPercentAsync(PlanCode code, int months, CancellationToken ct = default);
    Task<BankPricingTier> AddTierAsync(PlanCode code, int months, int discountPercent, DateTime? startDate, DateTime? endDate, int? maxRedemptions, CancellationToken ct = default);
    Task<BankPricingTier> UpdateTierAsync(Guid id, int? discountPercent, bool? active, DateTime? startDate, DateTime? endDate, int? maxRedemptions, bool clearStartDate, bool clearEndDate, bool clearMaxRedemptions, CancellationToken ct = default);
    Task DeleteTierAsync(Guid id, CancellationToken ct = default);
    /// <summary>Atomically bump the confirmed-redemption counter for the matching active tier.</summary>
    Task IncrementRedemptionAsync(PlanCode code, int months, CancellationToken ct = default);
    /// <summary>Seed sensible defaults for paid plans if no tiers exist at all.</summary>
    Task SeedDefaultsIfEmptyAsync(CancellationToken ct = default);
    void InvalidateCache();
}

public sealed class BankPricingService : IBankPricingService
{
    private readonly ResumeDbContext _db;
    private readonly IMemoryCache _cache;
    private const string CacheKey = "bank_pricing_tiers_all";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    // Default tiers seeded for paid plans on first run.
    private static readonly (int Months, int Discount)[] DefaultTiers =
        { (1, 0), (3, 10), (6, 20), (12, 30) };

    public BankPricingService(ResumeDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    private async Task<List<BankPricingTier>> GetCachedAsync(CancellationToken ct)
    {
        if (_cache.TryGetValue(CacheKey, out List<BankPricingTier>? cached) && cached is not null)
            return cached;
        var all = await _db.BankPricingTiers.AsNoTracking()
            .OrderBy(t => t.PlanCode).ThenBy(t => t.Months)
            .ToListAsync(ct);
        _cache.Set(CacheKey, all, CacheTtl);
        return all;
    }

    public async Task<IReadOnlyList<BankPricingTier>> GetActiveTiersAsync(PlanCode code, CancellationToken ct = default)
    {
        var all = await GetCachedAsync(ct);
        return all.Where(t => t.PlanCode == code && t.Active).OrderBy(t => t.Months).ToList();
    }

    public async Task<IReadOnlyList<BankPricingTier>> GetAllTiersAsync(PlanCode code, CancellationToken ct = default)
    {
        var all = await GetCachedAsync(ct);
        return all.Where(t => t.PlanCode == code).OrderBy(t => t.Months).ToList();
    }

    public async Task<int?> GetDiscountPercentAsync(PlanCode code, int months, CancellationToken ct = default)
    {
        var all = await GetCachedAsync(ct);
        var tier = all.FirstOrDefault(t => t.PlanCode == code && t.Months == months && t.Active);
        if (tier is null) return null;
        // The duration stays purchasable, but the discount only applies while the promo
        // window is open and the quantity (if capped) is not yet exhausted. Otherwise full price.
        return IsPromoActive(tier, DateTime.UtcNow) ? tier.DiscountPercent : 0;
    }

    /// <summary>
    /// Whether a tier's discount currently applies: started, not ended, and not sold out.
    /// A tier with no start/end/quantity constraints is always active (back-compat).
    /// </summary>
    public static bool IsPromoActive(BankPricingTier tier, DateTime nowUtc)
    {
        if (tier.StartDate.HasValue && nowUtc < tier.StartDate.Value) return false;
        if (tier.EndDate.HasValue && nowUtc > tier.EndDate.Value) return false;
        if (tier.MaxRedemptions.HasValue && tier.Redemptions >= tier.MaxRedemptions.Value) return false;
        return true;
    }

    public async Task<BankPricingTier> AddTierAsync(PlanCode code, int months, int discountPercent, DateTime? startDate, DateTime? endDate, int? maxRedemptions, CancellationToken ct = default)
    {
        if (code == PlanCode.Free) throw new ArgumentException("Free plan has no paid durations.");
        if (months < 1) throw new ArgumentException("Months must be >= 1.");
        if (discountPercent is < 0 or > 100) throw new ArgumentException("Discount must be between 0 and 100.");
        if (maxRedemptions is < 1) throw new ArgumentException("Quantity must be >= 1 (leave blank for unlimited).");
        if (startDate.HasValue && endDate.HasValue && endDate.Value <= startDate.Value)
            throw new ArgumentException("End date must be after start date.");
        if (await _db.BankPricingTiers.AnyAsync(t => t.PlanCode == code && t.Months == months, ct))
            throw new ArgumentException($"A {months}-month tier already exists for {code}.");

        var tier = new BankPricingTier
        {
            PlanCode = code,
            Months = months,
            DiscountPercent = discountPercent,
            StartDate = startDate?.ToUniversalTime(),
            EndDate = endDate?.ToUniversalTime(),
            MaxRedemptions = maxRedemptions,
        };
        _db.BankPricingTiers.Add(tier);
        await _db.SaveChangesAsync(ct);
        InvalidateCache();
        return tier;
    }

    public async Task<BankPricingTier> UpdateTierAsync(Guid id, int? discountPercent, bool? active, DateTime? startDate, DateTime? endDate, int? maxRedemptions, bool clearStartDate, bool clearEndDate, bool clearMaxRedemptions, CancellationToken ct = default)
    {
        var tier = await _db.BankPricingTiers.FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw new KeyNotFoundException("Pricing tier not found.");
        if (discountPercent.HasValue)
        {
            if (discountPercent.Value is < 0 or > 100) throw new ArgumentException("Discount must be between 0 and 100.");
            tier.DiscountPercent = discountPercent.Value;
        }
        if (active.HasValue) tier.Active = active.Value;
        if (clearStartDate) tier.StartDate = null;
        else if (startDate.HasValue) tier.StartDate = startDate.Value.ToUniversalTime();
        if (clearEndDate) tier.EndDate = null;
        else if (endDate.HasValue) tier.EndDate = endDate.Value.ToUniversalTime();
        if (clearMaxRedemptions) tier.MaxRedemptions = null;
        else if (maxRedemptions.HasValue)
        {
            if (maxRedemptions.Value < 1) throw new ArgumentException("Quantity must be >= 1 (leave blank for unlimited).");
            tier.MaxRedemptions = maxRedemptions.Value;
        }
        if (tier.StartDate.HasValue && tier.EndDate.HasValue && tier.EndDate.Value <= tier.StartDate.Value)
            throw new ArgumentException("End date must be after start date.");
        tier.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        InvalidateCache();
        return tier;
    }

    public async Task IncrementRedemptionAsync(PlanCode code, int months, CancellationToken ct = default)
    {
        var affected = await _db.BankPricingTiers
            .Where(t => t.PlanCode == code && t.Months == months)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Redemptions, t => t.Redemptions + 1)
                .SetProperty(t => t.UpdatedAt, DateTime.UtcNow), ct);
        if (affected > 0) InvalidateCache();
    }

    public async Task DeleteTierAsync(Guid id, CancellationToken ct = default)
    {
        var tier = await _db.BankPricingTiers.FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw new KeyNotFoundException("Pricing tier not found.");
        _db.BankPricingTiers.Remove(tier);
        await _db.SaveChangesAsync(ct);
        InvalidateCache();
    }

    public async Task SeedDefaultsIfEmptyAsync(CancellationToken ct = default)
    {
        if (await _db.BankPricingTiers.AnyAsync(ct)) return;

        foreach (var plan in PlanCatalog.All.Where(p => p.IsPaid))
        {
            foreach (var (months, discount) in DefaultTiers)
            {
                _db.BankPricingTiers.Add(new BankPricingTier
                {
                    PlanCode = plan.Code,
                    Months = months,
                    DiscountPercent = discount,
                });
            }
        }
        await _db.SaveChangesAsync(ct);
        InvalidateCache();
    }

    public void InvalidateCache() => _cache.Remove(CacheKey);
}
