using System.Text.RegularExpressions;
using DResume.Api.Ai;
using DResume.Api.Contracts;

namespace DResume.Api.Features.CompanyReview.Sources;

public sealed class GlassdoorSource : ICompanyReviewSource
{
    private readonly IAnthropicClient _ai;
    private readonly ILogger<GlassdoorSource> _logger;
    private static readonly Regex OverviewLinkRegex = new(
        "href=\"/Overview/Working-at-([A-Za-z0-9-]+)-EI_IE(\\d+)\\.\\d+,\\d+\\.htm\"",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public string Name => "Glassdoor";

    public GlassdoorSource(IAnthropicClient ai, ILogger<GlassdoorSource> logger)
    {
        _ai = ai;
        _logger = logger;
    }

    public async Task<CompanyReviewSourceResult> FetchAsync(string companyName, CancellationToken ct)
    {
        try
        {
            var searchUrl = $"https://www.glassdoor.com/Search/results.htm?keyword={Uri.EscapeDataString(companyName)}";
            var searchRes = await CurlScraper.FetchAsync(searchUrl, "en-US,en;q=0.9", ct);

            if (searchRes.Error is not null)
                return new CompanyReviewSourceResult(null, [], $"Glassdoor fetch failed: {searchRes.Error}");
            if (searchRes.StatusCode == 403 || searchRes.StatusCode == 429)
                return new CompanyReviewSourceResult(null, [], "Glassdoor blocked the request (Cloudflare).");
            if (searchRes.StatusCode < 200 || searchRes.StatusCode >= 300)
                return new CompanyReviewSourceResult(null, [], $"Glassdoor search returned HTTP {searchRes.StatusCode}.");

            var overviewMatch = OverviewLinkRegex.Match(searchRes.Body);
            if (!overviewMatch.Success)
                return new CompanyReviewSourceResult(null, [], "Company not found on Glassdoor.");

            var slug = overviewMatch.Groups[1].Value;
            var employerId = overviewMatch.Groups[2].Value;
            var reviewsUrl = $"https://www.glassdoor.com/Reviews/{slug}-Reviews-E{employerId}.htm";

            var pageRes = await CurlScraper.FetchAsync(reviewsUrl, "en-US,en;q=0.9", ct);
            if (pageRes.Error is not null)
                return new CompanyReviewSourceResult(null, [], $"Glassdoor reviews fetch failed: {pageRes.Error}");
            if (pageRes.StatusCode == 403 || pageRes.StatusCode == 429)
                return new CompanyReviewSourceResult(null, [], "Glassdoor blocked the request (Cloudflare).");
            if (pageRes.StatusCode < 200 || pageRes.StatusCode >= 300)
                return new CompanyReviewSourceResult(null, [], $"Glassdoor reviews page returned HTTP {pageRes.StatusCode}.");

            var cleaned = ScraperBase.StripHtml(pageRes.Body);
            if (cleaned.Length < 500)
                return new CompanyReviewSourceResult(null, [], "Glassdoor returned no usable content (login wall).");

            return await ClaudeExtractor.ExtractAsync(_ai, Name, reviewsUrl, companyName, cleaned, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Glassdoor scrape failed for {Company}", companyName);
            return new CompanyReviewSourceResult(null, [], ex.Message);
        }
    }
}
