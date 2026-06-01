namespace DResume.Api.Contracts;

public sealed record CreatePortfolioRequest(string Subdomain, Guid ResumeId, string Theme);

public sealed record UpdatePortfolioRequest(string? Subdomain, Guid? ResumeId, string? Theme, bool? HideContact);

public sealed record PortfolioDto(
    Guid Id,
    string Subdomain,
    Guid ResumeId,
    string? ResumeTitle,
    string Theme,
    string Status,
    bool HideContact,
    string? RejectReason,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record SubdomainAvailabilityDto(bool Available, string? Reason);

public sealed record PublicPortfolioDto(string Theme, bool HideContact, ResumeFormDataDto Resume);

public sealed record AdminPortfolioDto(
    Guid Id,
    Guid UserId,
    string? UserEmail,
    string Subdomain,
    string Theme,
    string Status,
    Guid ResumeId,
    string? ResumeTitle,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    string? RejectReason);

public sealed record RejectPortfolioRequest(string Reason);
