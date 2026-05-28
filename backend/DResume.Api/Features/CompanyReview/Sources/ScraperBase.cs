using System.Text.RegularExpressions;

namespace DResume.Api.Features.CompanyReview.Sources;

internal static class ScraperBase
{
    public const string UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    public static readonly Regex ScriptRegex = new("<script[\\s\\S]*?</script>", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    public static readonly Regex StyleRegex = new("<style[\\s\\S]*?</style>", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    public static readonly Regex TagRegex = new("<[^>]+>", RegexOptions.Compiled);
    public static readonly Regex WhitespaceRegex = new("\\s{2,}", RegexOptions.Compiled);

    public static HttpRequestMessage BuildRequest(HttpMethod method, string url, string acceptLanguage = "en-US,en;q=0.9,vi;q=0.8")
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.UserAgent.ParseAdd(UserAgent);
        req.Headers.Accept.ParseAdd("text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
        req.Headers.AcceptLanguage.ParseAdd(acceptLanguage);
        req.Headers.AcceptEncoding.ParseAdd("gzip, deflate, br");
        req.Headers.TryAddWithoutValidation("Sec-Fetch-Dest", "document");
        req.Headers.TryAddWithoutValidation("Sec-Fetch-Mode", "navigate");
        req.Headers.TryAddWithoutValidation("Sec-Fetch-Site", "none");
        req.Headers.TryAddWithoutValidation("Sec-Fetch-User", "?1");
        req.Headers.TryAddWithoutValidation("Upgrade-Insecure-Requests", "1");
        req.Headers.TryAddWithoutValidation("sec-ch-ua", "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not:A-Brand\";v=\"99\"");
        req.Headers.TryAddWithoutValidation("sec-ch-ua-mobile", "?0");
        req.Headers.TryAddWithoutValidation("sec-ch-ua-platform", "\"Windows\"");
        req.Headers.TryAddWithoutValidation("DNT", "1");
        return req;
    }

    public static string StripHtml(string html)
    {
        var text = ScriptRegex.Replace(html, " ");
        text = StyleRegex.Replace(text, " ");
        text = TagRegex.Replace(text, " ");
        text = DecodeEntities(text);
        text = WhitespaceRegex.Replace(text, " ").Trim();
        return text;
    }

    public static string DecodeEntities(string s)
    {
        s = s.Replace("&amp;", "&").Replace("&lt;", "<").Replace("&gt;", ">")
             .Replace("&nbsp;", " ").Replace("&quot;", "\"").Replace("&#39;", "'");
        s = Regex.Replace(s, "&#(\\d+);", m => char.ConvertFromUtf32(int.Parse(m.Groups[1].Value)));
        s = Regex.Replace(s, "&[a-z]+;", " ");
        return s;
    }

    public static string Slugify(string s)
    {
        var lower = s.Trim().ToLowerInvariant();
        var ascii = RemoveVietnameseAccents(lower);
        var replaced = Regex.Replace(ascii, "[^a-z0-9]+", "-");
        return replaced.Trim('-');
    }

    private static string RemoveVietnameseAccents(string s)
    {
        s = Regex.Replace(s, "[àáảãạăằắẳẵặâầấẩẫậ]", "a");
        s = Regex.Replace(s, "[èéẻẽẹêềếểễệ]", "e");
        s = Regex.Replace(s, "[ìíỉĩị]", "i");
        s = Regex.Replace(s, "[òóỏõọôồốổỗộơờớởỡợ]", "o");
        s = Regex.Replace(s, "[ùúủũụưừứửữự]", "u");
        s = Regex.Replace(s, "[ỳýỷỹỵ]", "y");
        s = s.Replace("đ", "d");
        return s;
    }

    public static double? ParseRating(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var m = Regex.Match(s, "(\\d+(?:[\\.,]\\d+)?)");
        if (!m.Success) return null;
        return double.TryParse(m.Groups[1].Value.Replace(',', '.'),
            System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : null;
    }

    public static int? ParseEmployeeCount(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var m = Regex.Match(s, "(\\d+(?:[\\.,]\\d+)*)");
        if (!m.Success) return null;
        var digits = m.Groups[1].Value.Replace(",", "").Replace(".", "");
        return int.TryParse(digits, out var n) ? n : null;
    }
}
