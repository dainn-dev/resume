using System.Text.Json;
using System.Text.RegularExpressions;
using DResume.Api.Ai;
using DResume.Api.Contracts;

namespace DResume.Api.Features.JobMatch;

public interface IJobMatchService
{
    Task<(JobMatchAnalysisDto Analysis, string JobDescription)> AnalyzeAsync(
        string resumeText, string? jobDescription, string? linkedinUrl, CancellationToken ct = default);
}

public sealed class JobMatchService : IJobMatchService
{
    private readonly IAnthropicClient _ai;
    private readonly IHttpClientFactory _httpFactory;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Regex TagRegex = new("<[^>]+>", RegexOptions.Compiled);
    private static readonly Regex ScriptRegex = new("<script[\\s\\S]*?</script>", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex StyleRegex = new("<style[\\s\\S]*?</style>", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex WhitespaceRegex = new("\\s{2,}", RegexOptions.Compiled);

    public JobMatchService(IAnthropicClient ai, IHttpClientFactory httpFactory)
    {
        _ai = ai;
        _httpFactory = httpFactory;
    }

    public async Task<(JobMatchAnalysisDto, string)> AnalyzeAsync(
        string resumeText, string? jobDescription, string? linkedinUrl, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(resumeText))
            throw new ArgumentException("Resume text is required.");

        var jd = jobDescription ?? string.Empty;
        if (string.IsNullOrWhiteSpace(jd) && !string.IsNullOrWhiteSpace(linkedinUrl))
            jd = await FetchJobDescriptionAsync(linkedinUrl.Trim(), ct);

        if (string.IsNullOrWhiteSpace(jd))
            throw new ArgumentException("Please provide a job description or URL.");

        var lang = LanguageDetector.Detect(resumeText);
        var sys = PromptLibrary.JobMatchSystem + "\n" + LanguageDetector.Instruction(lang);
        var raw = await _ai.CompleteAsync(sys, PromptLibrary.JobMatchUser(resumeText, jd), 2000, ct);
        var analysis = JsonSerializer.Deserialize<JobMatchAnalysisDto>(JsonExtractor.Extract(raw), JsonOptions)!;
        return (analysis, jd);
    }

    private async Task<string> FetchJobDescriptionAsync(string url, CancellationToken ct)
    {
        var http = _httpFactory.CreateClient("jd-scraper");
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
        req.Headers.Accept.ParseAdd("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
        req.Headers.AcceptLanguage.ParseAdd("en-US,en;q=0.9");

        using var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException($"Failed to fetch URL (HTTP {(int)res.StatusCode}). Please paste the job description manually.");

        var html = await res.Content.ReadAsStringAsync(ct);
        var text = ScriptRegex.Replace(html, " ");
        text = StyleRegex.Replace(text, " ");
        text = TagRegex.Replace(text, " ");
        text = text.Replace("&amp;", "&").Replace("&lt;", "<").Replace("&gt;", ">").Replace("&nbsp;", " ");
        text = Regex.Replace(text, "&#\\d+;", " ");
        text = Regex.Replace(text, "&[a-z]+;", " ");
        text = WhitespaceRegex.Replace(text, " ").Trim();

        if (text.Length < 300)
            throw new InvalidOperationException("Could not extract text from that URL (login required or blocked). Please paste the job description manually.");

        return text.Length > 5000 ? text[..5000] : text;
    }
}
