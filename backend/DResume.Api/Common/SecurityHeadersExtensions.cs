using Microsoft.Extensions.Options;

namespace DResume.Api.Common;

/// <summary>
/// Adds the standard security response headers (P0-5) to every API response:
/// <list type="bullet">
///   <item><c>X-Content-Type-Options: nosniff</c> — stop MIME sniffing.</item>
///   <item><c>X-Frame-Options: DENY</c> — block framing / clickjacking.</item>
///   <item><c>Referrer-Policy: no-referrer</c> — never leak the API URL as a referrer.</item>
///   <item><c>Content-Security-Policy</c> — strict <c>default-src 'none'</c> for the JSON API.</item>
///   <item><c>Strict-Transport-Security</c> — HSTS, in non-Development only (TLS is terminated by Caddy).</item>
/// </list>
/// Values are configurable via the <c>SecurityHeaders</c> config section (<see cref="SecurityHeadersOptions"/>).
/// The Swagger UI (Development only) is exempted from the CSP and X-Frame-Options headers so it stays usable.
/// </summary>
public static class SecurityHeadersExtensions
{
    public static IServiceCollection AddDResumeSecurityHeaders(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<SecurityHeadersOptions>(config.GetSection(SecurityHeadersOptions.SectionName));
        return services;
    }

    public static IApplicationBuilder UseDResumeSecurityHeaders(this WebApplication app)
    {
        var options = app.Services.GetRequiredService<IOptions<SecurityHeadersOptions>>().Value;
        var isDevelopment = app.Environment.IsDevelopment();

        // Browsers only honour HSTS over HTTPS, and we don't want it interfering with local http dev,
        // so emit it only outside Development. The header is built once at startup.
        string? hstsHeader = null;
        if (options.EnableHsts && !isDevelopment)
        {
            hstsHeader = $"max-age={Math.Max(0, options.HstsMaxAgeSeconds)}";
            if (options.HstsIncludeSubDomains) hstsHeader += "; includeSubDomains";
            if (options.HstsPreload) hstsHeader += "; preload";
        }

        app.Use(async (ctx, next) =>
        {
            // Set headers before the response body starts streaming.
            ctx.Response.OnStarting(() =>
            {
                var headers = ctx.Response.Headers;
                headers["X-Content-Type-Options"] = "nosniff";

                if (!string.IsNullOrWhiteSpace(options.ReferrerPolicy))
                    headers["Referrer-Policy"] = options.ReferrerPolicy;

                if (hstsHeader is not null)
                    headers["Strict-Transport-Security"] = hstsHeader;

                // Swagger UI relies on inline scripts/styles and same-origin framing, which a strict
                // CSP / X-Frame-Options: DENY would break. It only runs in Development, so skip those
                // two headers for the swagger paths while still sending nosniff/HSTS/referrer.
                var isSwagger = ctx.Request.Path.StartsWithSegments("/swagger");
                if (!isSwagger)
                {
                    if (!string.IsNullOrWhiteSpace(options.FrameOptions))
                        headers["X-Frame-Options"] = options.FrameOptions;
                    if (!string.IsNullOrWhiteSpace(options.ContentSecurityPolicy))
                        headers["Content-Security-Policy"] = options.ContentSecurityPolicy;
                }

                return Task.CompletedTask;
            });

            await next();
        });

        return app;
    }
}
