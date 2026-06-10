using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace DResume.Api.Common;

/// <summary>
/// Wires the ASP.NET Core rate limiter with two named policies (P0-4):
/// <list type="bullet">
///   <item><see cref="AiPolicy"/> — partitioned per authenticated user (token bucket); protects the
///   AI cost / monthly quota from being drained in minutes by a leaked token.</item>
///   <item><see cref="AuthPolicy"/> — partitioned per client IP (fixed window); blunts credential
///   stuffing and mass registration on the public auth endpoints.</item>
/// </list>
/// Exceeding either limit returns HTTP 429 with the standard <see cref="ApiResult{T}"/> envelope.
///
/// <para><b>Cluster-safe note:</b> these limiters keep their counters in-memory and are NOT shared
/// across instances. For the single-instance MVP this is acceptable; a multi-instance deployment
/// needs a distributed backing store (Redis) — see P1-4.</para>
/// </summary>
public static class RateLimitingExtensions
{
    public const string AiPolicy = "ai";
    public const string AuthPolicy = "auth";

    public static IServiceCollection AddDResumeRateLimiting(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<RateLimitingOptions>(config.GetSection(RateLimitingOptions.SectionName));
        var options = config.GetSection(RateLimitingOptions.SectionName).Get<RateLimitingOptions>()
                      ?? new RateLimitingOptions();

        services.AddRateLimiter(limiter =>
        {
            limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // AI endpoints: throttle per authenticated user (fall back to client IP for anonymous
            // callers such as /api/translate). A token bucket lets the normal pipeline fire a short
            // burst, then settles to one call every AiReplenishSeconds.
            limiter.AddPolicy(AiPolicy, ctx =>
                RateLimitPartition.GetTokenBucketLimiter(UserOrIpKey(ctx), _ => new TokenBucketRateLimiterOptions
                {
                    TokenLimit = Math.Max(1, options.AiBurst),
                    TokensPerPeriod = 1,
                    ReplenishmentPeriod = TimeSpan.FromSeconds(Math.Max(1, options.AiReplenishSeconds)),
                    QueueLimit = 0,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    AutoReplenishment = true,
                }));

            // Auth endpoints: throttle per client IP within a fixed window.
            limiter.AddPolicy(AuthPolicy, ctx =>
                RateLimitPartition.GetFixedWindowLimiter(ClientIp(ctx), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = Math.Max(1, options.AuthPermitLimit),
                    Window = TimeSpan.FromSeconds(Math.Max(1, options.AuthWindowSeconds)),
                    QueueLimit = 0,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                }));

            limiter.OnRejected = async (ctx, token) =>
            {
                if (ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    ctx.HttpContext.Response.Headers.RetryAfter =
                        ((int)retryAfter.TotalSeconds).ToString(System.Globalization.CultureInfo.InvariantCulture);

                ctx.HttpContext.Response.ContentType = "application/json";
                await ctx.HttpContext.Response.WriteAsJsonAsync(
                    new ApiResult<object>(false, null, "Too many requests. Please slow down and try again shortly."),
                    token);
            };
        });

        return services;
    }

    private static string UserOrIpKey(HttpContext ctx)
    {
        var userId = ctx.User?.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? ctx.User?.FindFirstValue("sub");
        return !string.IsNullOrEmpty(userId) ? $"u:{userId}" : $"ip:{ClientIp(ctx)}";
    }

    private static string ClientIp(HttpContext ctx)
    {
        // The Next.js frontend proxies most traffic, so Connection.RemoteIpAddress is usually the proxy.
        // Prefer the left-most X-Forwarded-For entry (the original client) when present so the limit is
        // per real client, not per proxy. A caller hitting the backend directly could spoof this header,
        // but the backend is not meant to be publicly reachable without the proxy — acceptable for a
        // throttle (it never grants access, only restricts it).
        var forwarded = ctx.Request.Headers["X-Forwarded-For"].ToString();
        if (!string.IsNullOrWhiteSpace(forwarded))
        {
            var first = forwarded
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .FirstOrDefault();
            if (!string.IsNullOrEmpty(first)) return first;
        }

        return ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
