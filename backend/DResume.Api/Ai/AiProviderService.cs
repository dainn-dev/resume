using System.Text.Json;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace DResume.Api.Ai;

public sealed record ResolvedProvider(string Name, string BaseUrl, string ApiKey, string Model);

public interface IAiProviderService
{
    Task<ResolvedProvider> ResolveAsync(CancellationToken ct = default);
    Task<ResolvedProvider?> ResolveNextAsync(ResolvedProvider failed, CancellationToken ct = default);
    void InvalidateCache();
}

public sealed class AiProviderService : IAiProviderService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IMemoryCache _cache;
    private readonly AnthropicOptions _fallbackOpts;
    private readonly ILogger<AiProviderService> _logger;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private const string CacheKey = "ai_providers";
    private int _roundRobinIndex;

    public AiProviderService(
        IServiceScopeFactory scopeFactory,
        IMemoryCache cache,
        IOptions<AnthropicOptions> fallbackOpts,
        ILogger<AiProviderService> logger)
    {
        _scopeFactory = scopeFactory;
        _cache = cache;
        _fallbackOpts = fallbackOpts.Value;
        _logger = logger;
    }

    private async Task<List<AiProvider>> GetEnabledProvidersAsync(CancellationToken ct)
    {
        if (_cache.TryGetValue(CacheKey, out List<AiProvider>? cached) && cached is not null)
            return cached;

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ResumeDbContext>();
        var providers = await db.AiProviders
            .Where(p => p.IsEnabled)
            .OrderBy(p => p.Priority)
            .ThenBy(p => p.Name)
            .AsNoTracking()
            .ToListAsync(ct);

        _cache.Set(CacheKey, providers, TimeSpan.FromMinutes(5));
        return providers;
    }

    private static List<string> ParseModels(string json)
    {
        try { return JsonSerializer.Deserialize<List<string>>(json, JsonOpts) ?? []; }
        catch { return []; }
    }

    public async Task<ResolvedProvider> ResolveAsync(CancellationToken ct = default)
    {
        var providers = await GetEnabledProvidersAsync(ct);
        if (providers.Count == 0)
            return FallbackProvider();

        var provider = PickProvider(providers);
        var models = ParseModels(provider.ModelsJson);
        var model = PickModel(provider, models);

        return new ResolvedProvider(provider.Name, provider.BaseUrl, provider.ApiKey, model);
    }

    public async Task<ResolvedProvider?> ResolveNextAsync(ResolvedProvider failed, CancellationToken ct = default)
    {
        var providers = await GetEnabledProvidersAsync(ct);

        foreach (var p in providers)
        {
            var models = ParseModels(p.ModelsJson);
            if (models.Count == 0) continue;

            foreach (var m in models)
            {
                if (p.BaseUrl == failed.BaseUrl && m == failed.Model)
                    continue;
                _logger.LogWarning("Falling back from {Failed} to {Next} ({Model})", failed.Name, p.Name, m);
                return new ResolvedProvider(p.Name, p.BaseUrl, p.ApiKey, m);
            }
        }

        if (failed.BaseUrl != _fallbackOpts.BaseUrl || failed.Model != _fallbackOpts.Model)
        {
            _logger.LogWarning("All DB providers exhausted, falling back to appsettings config");
            return FallbackProvider();
        }

        return null;
    }

    public void InvalidateCache() => _cache.Remove(CacheKey);

    private AiProvider PickProvider(List<AiProvider> providers)
    {
        var rrProviders = providers.Where(p => p.RoundRobin).ToList();
        if (rrProviders.Count > 0)
        {
            var idx = Interlocked.Increment(ref _roundRobinIndex);
            return rrProviders[((idx - 1) % rrProviders.Count + rrProviders.Count) % rrProviders.Count];
        }
        return providers[0];
    }

    private string PickModel(AiProvider provider, List<string> models)
    {
        if (models.Count == 0)
            return _fallbackOpts.Model;

        if (!provider.RoundRobin || models.Count == 1)
            return models[0];

        var idx = Interlocked.Increment(ref _roundRobinIndex);
        return models[((idx - 1) % models.Count + models.Count) % models.Count];
    }

    private ResolvedProvider FallbackProvider()
        => new("appsettings", _fallbackOpts.BaseUrl, _fallbackOpts.ApiKey, _fallbackOpts.Model);
}
