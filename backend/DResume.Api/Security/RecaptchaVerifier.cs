using System.Text.Json;
using Microsoft.Extensions.Options;

namespace DResume.Api.Security;

public interface IRecaptchaVerifier
{
    Task<bool> VerifyAsync(string? token, string? remoteIp, CancellationToken ct = default);
}

public sealed class RecaptchaVerifier : IRecaptchaVerifier
{
    private readonly HttpClient _http;
    private readonly RecaptchaOptions _opts;
    private readonly ILogger<RecaptchaVerifier> _logger;

    public RecaptchaVerifier(HttpClient http, IOptions<RecaptchaOptions> opts, ILogger<RecaptchaVerifier> logger)
    {
        _http = http;
        _opts = opts.Value;
        _logger = logger;
    }

    public async Task<bool> VerifyAsync(string? token, string? remoteIp, CancellationToken ct = default)
    {
        // Bypass when disabled so dev environments without keys keep working.
        if (!_opts.Enabled) return true;

        if (string.IsNullOrWhiteSpace(_opts.SecretKey))
        {
            _logger.LogWarning("Recaptcha:Enabled is true but Recaptcha:SecretKey is not configured — rejecting request.");
            return false;
        }

        if (string.IsNullOrWhiteSpace(token)) return false;

        var fields = new Dictionary<string, string>
        {
            ["secret"] = _opts.SecretKey,
            ["response"] = token,
        };
        if (!string.IsNullOrWhiteSpace(remoteIp))
            fields["remoteip"] = remoteIp;

        try
        {
            using var content = new FormUrlEncodedContent(fields);
            using var res = await _http.PostAsync(_opts.VerifyUrl, content, ct);
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogWarning("reCAPTCHA siteverify returned status {Status}.", (int)res.StatusCode);
                return false;
            }

            await using var stream = await res.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            return doc.RootElement.TryGetProperty("success", out var success)
                   && success.ValueKind == JsonValueKind.True;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "reCAPTCHA verification request failed.");
            return false;
        }
    }
}
