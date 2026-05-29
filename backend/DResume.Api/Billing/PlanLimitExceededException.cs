namespace DResume.Api.Billing;

/// <summary>
/// Thrown when a user exceeds a quota on their current plan (e.g. monthly AI calls or
/// max resumes). Mapped to HTTP 402 (Payment Required) in <c>ExceptionHandlingMiddleware</c>.
/// </summary>
public sealed class PlanLimitExceededException : Exception
{
    public PlanLimitExceededException(string message) : base(message) { }
}
