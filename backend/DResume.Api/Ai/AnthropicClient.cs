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
    private readonly ILogger<AnthropicClient> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public AnthropicClient(HttpClient http, IOptions<AnthropicOptions> opts, ILogger<AnthropicClient> logger)
    {
        _opts = opts.Value;
        _logger = logger;
        var baseUrl = _opts.BaseUrl.TrimEnd('/');
        if (baseUrl.EndsWith("/v1", StringComparison.OrdinalIgnoreCase))
            baseUrl = baseUrl[..^3];
        _http = http;
        _http.BaseAddress = new Uri(baseUrl + "/");
        _http.Timeout = TimeSpan.FromSeconds(_opts.TimeoutSeconds);
    }

    private static readonly int[] RetryableStatusCodes = [429, 502, 503, 524];

    public async Task<string> CompleteAsync(string systemPrompt, string userPrompt, int maxTokens = 2000, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_opts.ApiKey))
            throw new InvalidOperationException("ANTHROPIC_API_KEY is not configured. Set Anthropic:ApiKey or the ANTHROPIC__APIKEY env var.");

        using var aiCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        aiCts.CancelAfter(TimeSpan.FromSeconds(_opts.TimeoutSeconds));
        var aiToken = aiCts.Token;

        const int maxRetries = 3;
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                var (res, body) = await SendRequestAsync(systemPrompt, userPrompt, maxTokens, aiToken);

                if (res.IsSuccessStatusCode)
                    return ParseResponse(body);

                var status = (int)res.StatusCode;
                if (attempt < maxRetries - 1 && RetryableStatusCodes.Contains(status))
                {
                    var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt + 1));
                    _logger.LogWarning("Anthropic API {Status}, retrying in {Delay}s (attempt {Attempt}/{Max})", status, delay.TotalSeconds, attempt + 1, maxRetries);
                    await Task.Delay(delay, CancellationToken.None);
                    continue;
                }

                _logger.LogWarning("Anthropic API {Status}: {Body}", status, body);
                throw new InvalidOperationException($"Anthropic API error {status}: {Truncate(body, 500)}");
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                if (ct.IsCancellationRequested) throw;
                if (attempt >= maxRetries - 1) throw;
                var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt + 1));
                _logger.LogWarning(ex, "Anthropic API transport error, retrying in {Delay}s (attempt {Attempt}/{Max})", delay.TotalSeconds, attempt + 1, maxRetries);
                aiCts.TryReset();
                aiCts.CancelAfter(TimeSpan.FromSeconds(_opts.TimeoutSeconds));
                await Task.Delay(delay, CancellationToken.None);
            }
        }
    }

    private async Task<(HttpResponseMessage res, string body)> SendRequestAsync(string systemPrompt, string userPrompt, int maxTokens, CancellationToken ct)
    {
        var payload = new
        {
            model = _opts.Model,
            max_tokens = maxTokens,
            stream = false,
            system = systemPrompt,
            messages = new[] { new { role = "user", content = userPrompt } }
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, "v1/messages")
        {
            Content = new StringContent(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json")
        };
        req.Headers.Add("x-api-key", _opts.ApiKey);
        req.Headers.Add("anthropic-version", _opts.ApiVersion);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _opts.ApiKey);

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
