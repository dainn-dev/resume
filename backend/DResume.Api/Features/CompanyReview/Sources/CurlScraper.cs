using System.Diagnostics;
using System.Text;

namespace DResume.Api.Features.CompanyReview.Sources;

/// <summary>
/// Shells out to system curl to bypass .NET HttpClient's distinctive TLS fingerprint (JA3).
/// Cloudflare and similar bot-detection services block .NET HttpClient based on the ClientHello
/// signature even when User-Agent/headers mimic Chrome — curl produces a JA3 closer to a browser.
/// </summary>
internal static class CurlScraper
{
    private static readonly string CurlPath = ResolveCurlPath();
    private const int TimeoutSeconds = 20;

    public static async Task<CurlResult> FetchAsync(string url, string acceptLanguage, CancellationToken ct)
    {
        var args = new List<string>
        {
            "-sS", "-L", "--compressed",
            "--max-time", TimeoutSeconds.ToString(),
            "-w", "%{http_code}",
            "-A", ScraperBase.UserAgent,
            "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "-H", $"Accept-Language: {acceptLanguage}",
            "-H", "Sec-Fetch-Dest: document",
            "-H", "Sec-Fetch-Mode: navigate",
            "-H", "Sec-Fetch-Site: none",
            "-H", "Sec-Fetch-User: ?1",
            "-H", "Upgrade-Insecure-Requests: 1",
            "-H", "sec-ch-ua: \"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not:A-Brand\";v=\"99\"",
            "-H", "sec-ch-ua-mobile: ?0",
            "-H", "sec-ch-ua-platform: \"Windows\"",
            "-H", "DNT: 1",
            url,
        };

        var psi = new ProcessStartInfo(CurlPath)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
        };
        foreach (var a in args) psi.ArgumentList.Add(a);

        using var proc = Process.Start(psi)
            ?? throw new InvalidOperationException("Failed to start curl process.");

        var stdoutTask = proc.StandardOutput.ReadToEndAsync(ct);
        var stderrTask = proc.StandardError.ReadToEndAsync(ct);

        try
        {
            await proc.WaitForExitAsync(ct);
        }
        catch (OperationCanceledException)
        {
            try { proc.Kill(true); } catch { /* ignore */ }
            throw;
        }

        var stdout = await stdoutTask;
        var stderr = await stderrTask;

        if (proc.ExitCode != 0)
            return new CurlResult(0, "", $"curl exited with code {proc.ExitCode}: {stderr.Trim()}");

        // Last 3 chars of stdout = HTTP status (from -w "%{http_code}")
        if (stdout.Length < 3)
            return new CurlResult(0, "", "curl returned empty output.");

        var statusStr = stdout[^3..];
        var body = stdout[..^3];
        if (!int.TryParse(statusStr, out var status))
            return new CurlResult(0, body, "Could not parse HTTP status from curl output.");

        return new CurlResult(status, body, null);
    }

    private static string ResolveCurlPath()
    {
        var sysCurl = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "curl.exe");
        if (File.Exists(sysCurl)) return sysCurl;
        return "curl"; // PATH fallback (Linux/Mac)
    }
}

internal sealed record CurlResult(int StatusCode, string Body, string? Error);
