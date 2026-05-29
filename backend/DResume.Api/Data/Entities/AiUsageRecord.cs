namespace DResume.Api.Data.Entities;

/// <summary>
/// Per-user monthly AI-call counter. One row per (user, calendar month). Incremented
/// atomically on each metered AI call to enforce the plan's <c>MonthlyAiCalls</c> quota.
/// </summary>
public class AiUsageRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }

    /// <summary>Calendar month in UTC, formatted "yyyyMM" (e.g. "202605").</summary>
    public string Period { get; set; } = string.Empty;

    public int Count { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
