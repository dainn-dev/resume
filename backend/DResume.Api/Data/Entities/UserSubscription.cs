using DResume.Api.Billing;

namespace DResume.Api.Data.Entities;

public class UserSubscription
{
    public Guid UserId { get; set; }
    public PlanCode PlanCode { get; set; } = PlanCode.Free;
    public string? StripeCustomerId { get; set; }
    public string? StripeSubscriptionId { get; set; }
    public string Status { get; set; } = "active";
    public bool CancelAtPeriodEnd { get; set; }
    public DateTime? CurrentPeriodEnd { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
