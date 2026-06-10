namespace DResume.Api.Common;

/// <summary>
/// Tunable values for the security response headers (P0-5): HSTS, X-Frame-Options,
/// X-Content-Type-Options, Referrer-Policy and Content-Security-Policy.
///
/// <para>The API only ever returns JSON (the Next.js frontend is a separate origin), so the default
/// CSP is intentionally strict — <c>default-src 'none'</c>. It does not gate the frontend, which sets
/// its own policy. The Swagger UI (Development only) is exempted from CSP/X-Frame so it keeps working.</para>
/// </summary>
public sealed class SecurityHeadersOptions
{
    public const string SectionName = "SecurityHeaders";

    /// <summary>Emit <c>Strict-Transport-Security</c>. Honoured by browsers only over HTTPS, so it is
    /// gated to non-Development environments where TLS is terminated by the reverse proxy (Caddy).</summary>
    public bool EnableHsts { get; set; } = true;

    /// <summary>HSTS <c>max-age</c> in seconds. Default is one year (recommended for production).</summary>
    public int HstsMaxAgeSeconds { get; set; } = 31_536_000;

    /// <summary>Append <c>includeSubDomains</c> to the HSTS header.</summary>
    public bool HstsIncludeSubDomains { get; set; } = true;

    /// <summary>Append <c>preload</c> to the HSTS header. Off by default — only enable once the domain
    /// is actually submitted to the HSTS preload list.</summary>
    public bool HstsPreload { get; set; } = false;

    /// <summary>Value for <c>X-Frame-Options</c>. <c>DENY</c> blocks all framing (clickjacking).</summary>
    public string FrameOptions { get; set; } = "DENY";

    /// <summary>Value for <c>Content-Security-Policy</c>. Strict by default since the API returns JSON.</summary>
    public string ContentSecurityPolicy { get; set; } = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

    /// <summary>Value for <c>Referrer-Policy</c>.</summary>
    public string ReferrerPolicy { get; set; } = "no-referrer";
}
