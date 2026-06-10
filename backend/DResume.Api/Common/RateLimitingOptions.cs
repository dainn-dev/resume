namespace DResume.Api.Common;

/// <summary>
/// Tunable thresholds for the per-second/minute request throttles (P0-4). These are independent of
/// the monthly AI quota (<c>UsageService</c> + <c>ConsumesAiCallAttribute</c>): the quota caps total
/// spend per billing period, while these limits stop a single leaked token from bursting through that
/// quota in minutes, and blunt credential-stuffing / mass-registration loops against the auth endpoints.
/// </summary>
public sealed class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    /// <summary>AI policy: burst capacity — the most calls a user may fire back-to-back before the
    /// sustained rate kicks in. Sized for the multi-step pipeline (parse → build → analyze).</summary>
    public int AiBurst { get; set; } = 5;

    /// <summary>AI policy: one token is replenished every this many seconds (sustained rate per user).</summary>
    public int AiReplenishSeconds { get; set; } = 5;

    /// <summary>Auth policy: max register/login attempts allowed per client IP within the window.</summary>
    public int AuthPermitLimit { get; set; } = 10;

    /// <summary>Auth policy: length of the fixed window in seconds.</summary>
    public int AuthWindowSeconds { get; set; } = 60;
}
