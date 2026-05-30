using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace DResume.Api.Ai;

public interface IAnthropicClient
{
    Task<string> CompleteAsync(string systemPrompt, string userPrompt, int maxTokens = 2000, CancellationToken ct = default);
}

public sealed class AnthropicClient : IAnthropicClient
{
    private readonly HttpClient _http;
    private readonly AnthropicOptions _opts;
    private readonly IAiProviderService _providerService;
    private readonly ILogger<AnthropicClient> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly int[] RetryableStatusCodes = [429, 502, 503, 524];

    public AnthropicClient(HttpClient http, IOptions<AnthropicOptions> opts, IAiProviderService providerService, ILogger<AnthropicClient> logger)
    {
        _opts = opts.Value;
        _providerService = providerService;
        _logger = logger;
        _http = http;
        _http.Timeout = TimeSpan.FromSeconds(_opts.TimeoutSeconds);
    }

    public async Task<string> CompleteAsync(string systemPrompt, string userPrompt, int maxTokens = 2000, CancellationToken ct = default)
    {
        var provider = await _providerService.ResolveAsync(ct);
        return await CompleteWithFallbackAsync(provider, systemPrompt, userPrompt, maxTokens, ct);
    }

    private async Task<string> CompleteWithFallbackAsync(ResolvedProvider provider, string systemPrompt, string userPrompt, int maxTokens, CancellationToken ct)
    {
        using var aiCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        aiCts.CancelAfter(TimeSpan.FromSeconds(_opts.TimeoutSeconds));
        var aiToken = aiCts.Token;

        const int maxRetries = 3;
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                var (res, body) = await SendRequestAsync(provider, systemPrompt, userPrompt, maxTokens, aiToken);

                if (res.IsSuccessStatusCode)
                    return ParseResponse(body);

                var status = (int)res.StatusCode;
                if (attempt < maxRetries - 1 && RetryableStatusCodes.Contains(status))
                {
                    var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt + 1));
                    _logger.LogWarning("[{Provider}] API {Status}, retrying in {Delay}s (attempt {Attempt}/{Max})",
                        provider.Name, status, delay.TotalSeconds, attempt + 1, maxRetries);
                    await Task.Delay(delay, CancellationToken.None);
                    continue;
                }

                _logger.LogWarning("[{Provider}] API {Status}: {Body}", provider.Name, status, Truncate(body, 300));
                var next = await _providerService.ResolveNextAsync(provider, ct);
                if (next is not null)
                    return await CompleteWithFallbackAsync(next, systemPrompt, userPrompt, maxTokens, ct);

                throw new InvalidOperationException($"AI API error {status} (all providers exhausted): {Truncate(body, 500)}");
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                if (ct.IsCancellationRequested) throw;

                if (attempt < maxRetries - 1)
                {
                    var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt + 1));
                    _logger.LogWarning(ex, "[{Provider}] transport error, retrying in {Delay}s (attempt {Attempt}/{Max})",
                        provider.Name, delay.TotalSeconds, attempt + 1, maxRetries);
                    aiCts.TryReset();
                    aiCts.CancelAfter(TimeSpan.FromSeconds(_opts.TimeoutSeconds));
                    await Task.Delay(delay, CancellationToken.None);
                    continue;
                }

                _logger.LogWarning(ex, "[{Provider}] exhausted retries, trying fallback", provider.Name);
                var next = await _providerService.ResolveNextAsync(provider, ct);
                if (next is not null)
                    return await CompleteWithFallbackAsync(next, systemPrompt, userPrompt, maxTokens, ct);

                throw;
            }
        }
    }

    private async Task<(HttpResponseMessage res, string body)> SendRequestAsync(
        ResolvedProvider provider, string systemPrompt, string userPrompt, int maxTokens, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(provider.ApiKey))
            throw new InvalidOperationException($"API key not configured for provider '{provider.Name}'.");

        var baseUrl = provider.BaseUrl.TrimEnd('/');
        if (baseUrl.EndsWith("/v1", StringComparison.OrdinalIgnoreCase))
            baseUrl = baseUrl[..^3];
        var url = baseUrl + "/v1/messages";

        var payload = new
        {
            model = provider.Model,
            max_tokens = maxTokens,
            stream = false,
            system = systemPrompt,
            messages = new[] { new { role = "user", content = userPrompt } }
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json")
        };
        req.Headers.Add("x-api-key", provider.ApiKey);
        req.Headers.Add("anthropic-version", _opts.ApiVersion);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", provider.ApiKey);

        var res = await _http.SendAsync(req, ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        return (res, body);
    }

    private string ParseResponse(string body)
    {
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        if (root.TryGetProperty("content", out var content) && content.ValueKind == JsonValueKind.Array)
        {
            var sb = new StringBuilder();
            foreach (var block in content.EnumerateArray())
            {
                if (block.TryGetProperty("type", out var t) && t.GetString() == "text"
                    && block.TryGetProperty("text", out var txt))
                    sb.Append(txt.GetString());
            }
            var text = sb.ToString();
            if (!string.IsNullOrWhiteSpace(text)) return text;
        }

        if (root.TryGetProperty("choices", out var choices) && choices.ValueKind == JsonValueKind.Array)
        {
            var sb = new StringBuilder();
            foreach (var c in choices.EnumerateArray())
            {
                if (c.TryGetProperty("message", out var msg) && msg.TryGetProperty("content", out var mc))
                    sb.Append(mc.GetString());
            }
            var text = sb.ToString();
            if (!string.IsNullOrWhiteSpace(text)) return text;
        }

        throw new InvalidOperationException("Unexpected response shape from model API.");
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max] + "…";
}
