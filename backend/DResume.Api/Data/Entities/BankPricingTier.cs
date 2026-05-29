using DResume.Api.Billing;

namespace DResume.Api.Data.Entities;

/// <summary>
/// A bank-transfer duration option for a paid plan (e.g. 3 months @ 10% off).
/// Admin-managed per plan; the gross amount is derived from the plan's MonthlyPriceVnd.
/// </summary>
public class BankPricingTier
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public PlanCode PlanCode { get; set; }

    /// <summary>Billing duration in months (>= 1).</summary>
    public int Months { get; set; }

    /// <summary>Discount applied to gross (monthly × months). 0–100.</summary>
    public int DiscountPercent { get; set; }

    /// <summary>Inactive tiers are hidden from checkout but kept for history.</summary>
    public bool Active { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
