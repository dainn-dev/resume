using DainnStripe.Data;
using DainnStripe.Entities;
using DainnStripe.Enums;
using DainnStripe.Interfaces;
using DainnStripe.Models;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Billing;

public interface IStripeCatalogSeeder
{
    Task SeedAsync(CancellationToken ct = default);
}

public sealed class StripeCatalogSeeder : IStripeCatalogSeeder
{
    private readonly IDainnStripeCatalogService _catalog;
    private readonly DainnStripeDbContext _stripeDb;
    private readonly ILogger<StripeCatalogSeeder> _logger;

    public StripeCatalogSeeder(IDainnStripeCatalogService catalog, DainnStripeDbContext stripeDb, ILogger<StripeCatalogSeeder> logger)
    {
        _catalog = catalog;
        _stripeDb = stripeDb;
        _logger = logger;
    }

    public async Task SeedAsync(CancellationToken ct = default)
    {
        if (await IsAlreadySeededAsync(ct))
        {
            _logger.LogInformation("Stripe catalog already seeded — skipping sync.");
            return;
        }

        foreach (var plan in PlanCatalog.All)
        {
            try
            {
                await _catalog.UpsertProductAsync(new UpsertCatalogProductRequest
                {
                    LookupKey = plan.LookupKey,
                    Name = plan.Name,
                    Description = plan.Description,
                    Active = true,
                    MetadataJson = $"{{\"plan_code\":\"{plan.Code}\"}}",
                }, ct);

                if (plan.IsPaid)
                {
                    await _catalog.UpsertPriceAsync(new UpsertCatalogPriceRequest
                    {
                        ProductLookupKey = plan.LookupKey,
                        LookupKey = $"{plan.LookupKey}_monthly",
                        Currency = plan.Currency,
                        UnitAmount = plan.MonthlyPriceCents,
                        Interval = DainnStripePriceInterval.Month,
                        IntervalCount = 1,
                        Active = true,
                        MetadataJson = $"{{\"plan_code\":\"{plan.Code}\"}}",
                    }, ct);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to seed plan {Plan}. Subsequent attempts will retry on next startup.", plan.Code);
            }
        }

        _logger.LogInformation("Stripe catalog seeded successfully.");
    }

    private async Task<bool> IsAlreadySeededAsync(CancellationToken ct)
    {
        var requiredProducts = PlanCatalog.All.Select(p => p.LookupKey).ToList();
        var requiredPrices = PlanCatalog.All.Where(p => p.IsPaid).Select(p => $"{p.LookupKey}_monthly").ToList();

        var existingProductCount = await _stripeDb.Set<DainnStripeProduct>()
            .CountAsync(p => p.Active && requiredProducts.Contains(p.LookupKey!), ct);

        var existingPriceCount = await _stripeDb.Set<DainnStripePrice>()
            .CountAsync(p => p.Active && requiredPrices.Contains(p.LookupKey!), ct);

        return existingProductCount >= requiredProducts.Count
            && existingPriceCount >= requiredPrices.Count;
    }
}
