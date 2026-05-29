namespace DResume.Api.Billing;

public enum PlanCode { Free = 0, Pro = 1, Premium = 2 }

public sealed record PlanDefinition(
    PlanCode Code,
    string LookupKey,
    string Name,
    string Description,
    long MonthlyPriceCents,
    string Currency,
    PlanLimits Limits,
    long MonthlyPriceVnd = 0)
{
    public bool IsPaid => MonthlyPriceCents > 0 || MonthlyPriceVnd > 0;
}

public sealed record PlanLimits(
    int MaxResumes,
    int MonthlyAiCalls,
    bool JobMatchEnabled,
    bool CoverLetterEnabled,
    bool CareerCoachEnabled,
    bool InterviewCoachEnabled,
    bool SalaryEstimatorEnabled,
    bool CalendarEnabled,
    bool CompanyReviewEnabled,
    bool PriorityQueue);

public static class PlanCatalog
{
    public static readonly PlanDefinition Free = new(
        PlanCode.Free,
        LookupKey: "dresume_free",
        Name: "Free",
        Description: "Try DResume with limited monthly usage.",
        MonthlyPriceCents: 0,
        Currency: "usd",
        Limits: new PlanLimits(
            MaxResumes: 2,
            MonthlyAiCalls: 5,
            JobMatchEnabled: false,
            CoverLetterEnabled: false,
            CareerCoachEnabled: false,
            InterviewCoachEnabled: false,
            SalaryEstimatorEnabled: false,
            CalendarEnabled: false,
            CompanyReviewEnabled: false,
            PriorityQueue: false),
        MonthlyPriceVnd: 0);

    public static readonly PlanDefinition Pro = new(
        PlanCode.Pro,
        LookupKey: "dresume_pro_v2",
        Name: "Pro",
        Description: "Full access to all AI features for individuals.",
        MonthlyPriceCents: 499,
        Currency: "usd",
        Limits: new PlanLimits(
            MaxResumes: 50,
            MonthlyAiCalls: 200,
            JobMatchEnabled: true,
            CoverLetterEnabled: true,
            CareerCoachEnabled: true,
            InterviewCoachEnabled: true,
            SalaryEstimatorEnabled: true,
            CalendarEnabled: true,
            CompanyReviewEnabled: false,
            PriorityQueue: false),
        MonthlyPriceVnd: 129_000);

    public static readonly PlanDefinition Premium = new(
        PlanCode.Premium,
        LookupKey: "dresume_premium_v2",
        Name: "Premium",
        Description: "Unlimited usage with priority processing.",
        MonthlyPriceCents: 999,
        Currency: "usd",
        Limits: new PlanLimits(
            MaxResumes: int.MaxValue,
            MonthlyAiCalls: int.MaxValue,
            JobMatchEnabled: true,
            CoverLetterEnabled: true,
            CareerCoachEnabled: true,
            InterviewCoachEnabled: true,
            SalaryEstimatorEnabled: true,
            CalendarEnabled: true,
            CompanyReviewEnabled: true,
            PriorityQueue: true),
        MonthlyPriceVnd: 259_000);

    public static readonly IReadOnlyList<PlanDefinition> All = new[] { Free, Pro, Premium };

    public static PlanDefinition Get(PlanCode code) => code switch
    {
        PlanCode.Free => Free,
        PlanCode.Pro => Pro,
        PlanCode.Premium => Premium,
        _ => Free
    };

    // Map legacy/historical lookup keys to current plans so existing Stripe subscriptions
    // (created before a price/key migration) still resolve to the correct plan in webhooks.
    private static readonly Dictionary<string, PlanCode> LegacyLookupKeys = new()
    {
        ["dresume_pro"] = PlanCode.Pro,
        ["dresume_premium"] = PlanCode.Premium,
        ["dresume_enterprise"] = PlanCode.Premium, // renamed Enterprise → Premium
    };

    public static PlanDefinition? GetByLookupKey(string? lookupKey)
    {
        if (string.IsNullOrEmpty(lookupKey)) return null;
        var match = All.FirstOrDefault(p => p.LookupKey == lookupKey);
        if (match is not null) return match;
        return LegacyLookupKeys.TryGetValue(lookupKey, out var code) ? Get(code) : null;
    }
}
