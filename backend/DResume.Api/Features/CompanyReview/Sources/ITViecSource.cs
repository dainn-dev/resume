using DResume.Api.Ai;
using DResume.Api.Contracts;

namespace DResume.Api.Features.CompanyReview.Sources;

public sealed class ITViecSource : ICompanyReviewSource
{
    private readonly IAnthropicClient _ai;
    private readonly ILogger<ITViecSource> _logger;

    public string Name => "ITviec";

    public ITViecSource(IAnthropicClient ai, ILogger<ITViecSource> logger)
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

            var url = $"https://itviec.com/companies/{slug}/review";
            var res = await CurlScraper.FetchAsync(url, "vi-VN,vi;q=0.9,en;q=0.8", ct);

            if (res.Error is not null)
                return new CompanyReviewSourceResult(null, [], $"ITviec fetch failed: {res.Error}");
            if (res.StatusCode == 404)
                return new CompanyReviewSourceResult(null, [], "Company not found on ITviec.");
            if (res.StatusCode == 403 || res.StatusCode == 429)
                return new CompanyReviewSourceResult(null, [], "ITviec blocked the request.");
            if (res.StatusCode < 200 || res.StatusCode >= 300)
                return new CompanyReviewSourceResult(null, [], $"ITviec returned HTTP {res.StatusCode}.");

            var cleaned = ScraperBase.StripHtml(res.Body);
            if (cleaned.Length < 500)
                return new CompanyReviewSourceResult(null, [], "ITviec returned no usable content.");

            return await ClaudeExtractor.ExtractAsync(_ai, Name, url, companyName, cleaned, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ITviec scrape failed for {Company}", companyName);
            return new CompanyReviewSourceResult(null, [], ex.Message);
        }
    }
}
