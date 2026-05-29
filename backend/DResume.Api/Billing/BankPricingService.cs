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
    Task<BankPricingTier> AddTierAsync(PlanCode code, int months, int discountPercent, CancellationToken ct = default);
    Task<BankPricingTier> UpdateTierAsync(Guid id, int? discountPercent, bool? active, CancellationToken ct = default);
    Task DeleteTierAsync(Guid id, CancellationToken ct = default);
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
        return all.FirstOrDefault(t => t.PlanCode == code && t.Months == months && t.Active)?.DiscountPercent;
    }

    public async Task<BankPricingTier> AddTierAsync(PlanCode code, int months, int discountPercent, CancellationToken ct = default)
    {
        if (code == PlanCode.Free) throw new ArgumentException("Free plan has no paid durations.");
        if (months < 1) throw new ArgumentException("Months must be >= 1.");
        if (discountPercent is < 0 or > 100) throw new ArgumentException("Discount must be between 0 and 100.");
        if (await _db.BankPricingTiers.AnyAsync(t => t.PlanCode == code && t.Months == months, ct))
            throw new ArgumentException($"A {months}-month tier already exists for {code}.");

        var tier = new BankPricingTier { PlanCode = code, Months = months, DiscountPercent = discountPercent };
        _db.BankPricingTiers.Add(tier);
        await _db.SaveChangesAsync(ct);
        InvalidateCache();
        return tier;
    }

    public async Task<BankPricingTier> UpdateTierAsync(Guid id, int? discountPercent, bool? active, CancellationToken ct = default)
    {
        var tier = await _db.BankPricingTiers.FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw new KeyNotFoundException("Pricing tier not found.");
        if (discountPercent.HasValue)
        {
            if (discountPercent.Value is < 0 or > 100) throw new ArgumentException("Discount must be between 0 and 100.");
            tier.DiscountPercent = discountPercent.Value;
        }
        if (active.HasValue) tier.Active = active.Value;
        tier.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        InvalidateCache();
        return tier;
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
