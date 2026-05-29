using DResume.Api.Billing;

namespace DResume.Api.Data.Entities;

public class PlanRecord
{
    public PlanCode Code { get; set; }
    public string LookupKey { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public long MonthlyPriceCents { get; set; }
    public string Currency { get; set; } = "usd";
    public long MonthlyPriceVnd { get; set; }

    public int MaxResumes { get; set; }
    public int MonthlyAiCalls { get; set; }
    public bool JobMatchEnabled { get; set; }
    public bool CoverLetterEnabled { get; set; }
    public bool CareerCoachEnabled { get; set; }
    public bool InterviewCoachEnabled { get; set; }
    public bool SalaryEstimatorEnabled { get; set; }
    public bool CalendarEnabled { get; set; }
    public bool CompanyReviewEnabled { get; set; }
    public bool PriorityQueue { get; set; }

    /// <summary>Active Stripe Price ID used for new checkouts. Updated when price changes.</summary>
    public string? ActiveStripePriceId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
