using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using DainnUser.Core.Entities;
using DainnUser.Core.Interfaces.Services;
using DainnUser.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Features.Email;

public sealed class DResumeEmailService : IEmailService
{
    private static readonly HttpClient _http = new() { BaseAddress = new Uri("https://api.resend.com") };
    private static readonly JsonSerializerOptions _json = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<DResumeEmailService> _logger;

    public DResumeEmailService(IServiceScopeFactory scopeFactory, IConfiguration config, ILogger<DResumeEmailService> logger)
    {
        _scopeFactory = scopeFactory;
        _config = config;
        _logger = logger;
    }

    public async Task SendEmailVerificationAsync(string email, string name, string token, CancellationToken ct = default)
    {
        Guid? userId = null;
        await using (var scope = _scopeFactory.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DainnUserDbContext>();
            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email, ct);
            userId = user?.Id;
        }

        if (userId is null) return;

        var frontendUrl = _config["Cors:AllowedOrigins:0"] ?? "http://localhost:3000";
        var encodedToken = Uri.EscapeDataString(token);
        var verifyUrl = $"{frontendUrl}/verify-email?userId={userId}&token={encodedToken}";

        var html = $"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #111827; color: #e5e7eb; padding: 0; border-radius: 12px; overflow: hidden;">
              <div style="background: #2563eb; padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Email Verification</h1>
              </div>
              <div style="padding: 32px;">
                <p style="margin: 0 0 16px;">Hello {name},</p>
                <p style="margin: 0 0 24px;">Thank you for registering! Please click the button below to verify your email address.</p>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="{verifyUrl}" style="background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">Verify Email</a>
                </div>
                <p style="margin: 0 0 8px; color: #9ca3af; font-size: 13px;">Or copy this link into your browser:</p>
                <p style="margin: 0 0 24px; word-break: break-all; font-size: 12px; color: #6b7280; background: #1f2937; padding: 12px; border-radius: 6px;">{verifyUrl}</p>
                <p style="margin: 0 0 8px; color: #9ca3af; font-size: 13px;">This link will expire in 24 hours.</p>
                <p style="margin: 0; color: #6b7280; font-size: 12px;">If you didn't create an account, please ignore this email.</p>
              </div>
            </div>
            """;

        await SendViaResendAsync(email, "Verify Your Email — DResume", html, ct);
    }

    public Task SendPasswordResetAsync(string email, string name, string token, CancellationToken ct = default)
    {
        var frontendUrl = _config["Cors:AllowedOrigins:0"] ?? "http://localhost:3000";
        var encodedToken = Uri.EscapeDataString(token);
        var resetUrl = $"{frontendUrl}/reset-password?token={encodedToken}";

        var html = $"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #111827; color: #e5e7eb; padding: 0; border-radius: 12px; overflow: hidden;">
              <div style="background: #dc2626; padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset</h1>
              </div>
              <div style="padding: 32px;">
                <p style="margin: 0 0 16px;">Hello {name},</p>
                <p style="margin: 0 0 24px;">We received a request to reset your password. Click the button below to set a new password.</p>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="{resetUrl}" style="background: #dc2626; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">Reset Password</a>
                </div>
                <p style="margin: 0 0 8px; color: #9ca3af; font-size: 13px;">This link will expire in 24 hours.</p>
                <p style="margin: 0; color: #6b7280; font-size: 12px;">If you didn't request a password reset, please ignore this email.</p>
              </div>
            </div>
            """;

        return SendViaResendAsync(email, "Reset Your Password — DResume", html, ct);
    }

    public Task SendPasswordChangedNotificationAsync(string email, string name, CancellationToken ct = default)
    {
        var html = $"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #111827; color: #e5e7eb; padding: 32px; border-radius: 12px;">
              <h2 style="color: #f59e0b; margin: 0 0 16px;">Password Changed</h2>
              <p style="margin: 0 0 16px;">Hello {name}, your password was successfully changed. If you didn't make this change, please contact support immediately.</p>
            </div>
            """;
        return SendViaResendAsync(email, "Password Changed — DResume", html, ct);
    }

    public Task SendAccountLockoutNotificationAsync(string email, string name, DateTime lockoutEnd, CancellationToken ct = default)
    {
        var html = $"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #111827; color: #e5e7eb; padding: 32px; border-radius: 12px;">
              <h2 style="color: #ef4444; margin: 0 0 16px;">Account Locked</h2>
              <p style="margin: 0 0 16px;">Hello {name}, your account has been temporarily locked due to too many failed login attempts. It will be unlocked at {lockoutEnd:g} UTC.</p>
            </div>
            """;
        return SendViaResendAsync(email, "Account Locked — DResume", html, ct);
    }

    public Task SendTwoFactorCodeAsync(string email, string name, string code, CancellationToken ct = default)
    {
        var html = $"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #111827; color: #e5e7eb; padding: 32px; border-radius: 12px;">
              <h2 style="color: #2563eb; margin: 0 0 16px;">Your Verification Code</h2>
              <p style="margin: 0 0 24px;">Hello {name}, enter this code to complete your login:</p>
              <div style="text-align: center; background: #1f2937; padding: 16px; border-radius: 8px; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: white;">{code}</div>
              <p style="margin: 16px 0 0; color: #6b7280; font-size: 12px;">This code will expire in 10 minutes.</p>
            </div>
            """;
        return SendViaResendAsync(email, "Your Verification Code — DResume", html, ct);
    }

    public Task SendEmailAsync(string to, string? replyTo, string subject, string htmlBody, IEnumerable<EmailAttachment>? attachments = null, CancellationToken ct = default)
        => SendViaResendAsync(to, subject, htmlBody, ct);

    private async Task SendViaResendAsync(string to, string subject, string htmlBody, CancellationToken ct = default)
    {
        var section = _config.GetSection("DainnUser:Email");
        var apiKey = section["SmtpPassword"] ?? "";
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("Resend API key not configured — skipping email to {To}.", to);
            return;
        }

        var fromEmail = section["FromEmail"] ?? "noreply@dresume.local";
        var fromName = section["FromName"] ?? "DResume";

        var body = new ResendEmailPayload
        {
            From = $"{fromName} <{fromEmail}>",
            To = [to],
            Subject = subject,
            Html = htmlBody,
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "/emails")
        {
            Headers = { Authorization = new("Bearer", apiKey) },
            Content = JsonContent.Create(body, options: _json),
        };

        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);

        try
        {
            var response = await _http.SendAsync(request, linkedCts.Token);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(ct);
                _logger.LogError("Resend API error ({Status}): {Error}", (int)response.StatusCode, error);
                response.EnsureSuccessStatusCode();
            }
        }
        catch (OperationCanceledException)
        {
            if (!ct.IsCancellationRequested)
                _logger.LogWarning("Resend API request to {To} timed out.", to);
            throw;
        }
    }

    private sealed record ResendEmailPayload
    {
        [JsonPropertyName("from")] public required string From { get; init; }
        [JsonPropertyName("to")] public required string[] To { get; init; }
        [JsonPropertyName("subject")] public required string Subject { get; init; }
        [JsonPropertyName("html")] public required string Html { get; init; }
    }
}
