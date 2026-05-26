using DainnStripe.Enums;
using DainnStripe.Interfaces;
using DainnStripe.Models;

namespace DResume.Api.Billing;

public interface IStripeCatalogSeeder
{
    Task SeedAsync(CancellationToken ct = default);
}

public sealed class StripeCatalogSeeder : IStripeCatalogSeeder
{
    private readonly IDainnStripeCatalogService _catalog;
    private readonly ILogger<StripeCatalogSeeder> _logger;

    public StripeCatalogSeeder(IDainnStripeCatalogService catalog, ILogger<StripeCatalogSeeder> logger)
    {
        _catalog = catalog;
        _logger = logger;
    }

    public async Task SeedAsync(CancellationToken ct = default)
    {
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
    }
}
