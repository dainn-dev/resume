using DResume.Api.Contracts;

namespace DResume.Api.Features.CompanyReview.Sources;

public interface ICompanyReviewSource
{
    string Name { get; }
    Task<CompanyReviewSourceResult> FetchAsync(string companyName, CancellationToken ct);
}

public sealed record CompanyReviewSourceResult(
    CompanyInfoDto? Info,
    List<ReviewItemDto> Reviews,
    string? Error);
