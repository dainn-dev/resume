namespace DResume.Api.Billing;

public enum PlanCode { Free = 0, Pro = 1, Enterprise = 2 }

public sealed record PlanDefinition(
    PlanCode Code,
    string LookupKey,
    string Name,
    string Description,
    long MonthlyPriceCents,
    string Currency,
    PlanLimits Limits)
{
    public bool IsPaid => MonthlyPriceCents > 0;
}

public sealed record PlanLimits(
    int MaxResumes,
    int MonthlyAiCalls,
    bool JobMatchEnabled,
    bool CoverLetterEnabled,
    bool CareerCoachEnabled,
    bool InterviewCoachEnabled,
    bool SalaryEstimatorEnabled,
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
            PriorityQueue: false));

    public static readonly PlanDefinition Pro = new(
        PlanCode.Pro,
        LookupKey: "dresume_pro",
        Name: "Pro",
        Description: "Full access to all AI features for individuals.",
        MonthlyPriceCents: 999,
        Currency: "usd",
        Limits: new PlanLimits(
            MaxResumes: 50,
            MonthlyAiCalls: 200,
            JobMatchEnabled: true,
            CoverLetterEnabled: true,
            CareerCoachEnabled: true,
            InterviewCoachEnabled: true,
            SalaryEstimatorEnabled: true,
            PriorityQueue: false));

    public static readonly PlanDefinition Enterprise = new(
        PlanCode.Enterprise,
        LookupKey: "dresume_enterprise",
        Name: "Enterprise",
        Description: "Unlimited usage with priority processing for teams.",
        MonthlyPriceCents: 2999,
        Currency: "usd",
        Limits: new PlanLimits(
            MaxResumes: int.MaxValue,
            MonthlyAiCalls: int.MaxValue,
            JobMatchEnabled: true,
            CoverLetterEnabled: true,
            CareerCoachEnabled: true,
            InterviewCoachEnabled: true,
            SalaryEstimatorEnabled: true,
            PriorityQueue: true));

    public static readonly IReadOnlyList<PlanDefinition> All = new[] { Free, Pro, Enterprise };

    public static PlanDefinition Get(PlanCode code) => code switch
    {
        PlanCode.Free => Free,
        PlanCode.Pro => Pro,
        PlanCode.Enterprise => Enterprise,
        _ => Free
    };

    public static PlanDefinition? GetByLookupKey(string? lookupKey) =>
        string.IsNullOrEmpty(lookupKey) ? null : All.FirstOrDefault(p => p.LookupKey == lookupKey);
}
