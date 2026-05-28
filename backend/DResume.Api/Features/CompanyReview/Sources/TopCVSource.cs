using DResume.Api.Ai;
using DResume.Api.Contracts;

namespace DResume.Api.Features.CompanyReview.Sources;

public sealed class TopCVSource : ICompanyReviewSource
{
    private readonly IAnthropicClient _ai;
    private readonly ILogger<TopCVSource> _logger;

    public string Name => "TopCV";

    public TopCVSource(IAnthropicClient ai, ILogger<TopCVSource> logger)
    {
        _ai = ai;
        _logger = logger;
    }

    public async Task<CompanyReviewSourceResult> FetchAsync(string companyName, CancellationToken ct)
    {
        try
        {
            var slug = ScraperBase.Slugify(companyName);
            if (string.IsNullOrEmpty(slug))
                return new CompanyReviewSourceResult(null, [], "Invalid company name.");

            var candidates = new[]
            {
                $"https://www.topcv.vn/cong-ty/{slug}",
                $"https://www.topcv.vn/cong-ty/{slug}/danh-gia",
                $"https://review.topcv.vn/cong-ty/{slug}",
            };

            foreach (var url in candidates)
            {
                var res = await CurlScraper.FetchAsync(url, "vi-VN,vi;q=0.9,en;q=0.8", ct);
                if (res.Error is not null) continue;
                if (res.StatusCode == 403 || res.StatusCode == 429)
                    return new CompanyReviewSourceResult(null, [], "TopCV blocked the request.");
                if (res.StatusCode < 200 || res.StatusCode >= 300) continue;

                var cleaned = ScraperBase.StripHtml(res.Body);
                if (cleaned.Length < 500) continue;

                return await ClaudeExtractor.ExtractAsync(_ai, Name, url, companyName, cleaned, ct);
            }

            return new CompanyReviewSourceResult(null, [], "Company not found on TopCV.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "TopCV scrape failed for {Company}", companyName);
            return new CompanyReviewSourceResult(null, [], ex.Message);
        }
    }
}
