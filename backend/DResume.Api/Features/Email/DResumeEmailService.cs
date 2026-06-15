using System.Net;
using System.Net.Mail;
using DainnUser.Core.Entities;
using DainnUser.Core.Interfaces.Services;
using DainnUser.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Features.Email;

public sealed class DResumeEmailService : IEmailService
{
    // Use a scope factory instead of a direct DainnUserDbContext injection so that the user-lookup
    // query in SendEmailVerificationAsync runs on its own DbContext instance. DainnUser's
    // RegisterAsync() holds the shared scoped DbContext inside an active transaction when it calls
    // IEmailService, so querying the same DbContext concurrently throws InvalidOperationException.
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
        // Resolve user.Id in a fresh scope so we don't conflict with the caller's DbContext.
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

        await SendSmtpAsync(email, "Verify Your Email — DResume", html);
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

        return SendSmtpAsync(email, "Reset Your Password — DResume", html);
    }

    public Task SendPasswordChangedNotificationAsync(string email, string name, CancellationToken ct = default)
    {
        var html = $"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #111827; color: #e5e7eb; padding: 32px; border-radius: 12px;">
              <h2 style="color: #f59e0b; margin: 0 0 16px;">Password Changed</h2>
              <p style="margin: 0 0 16px;">Hello {name}, your password was successfully changed. If you didn't make this change, please contact support immediately.</p>
            </div>
            """;
        return SendSmtpAsync(email, "Password Changed — DResume", html);
    }

    public Task SendAccountLockoutNotificationAsync(string email, string name, DateTime lockoutEnd, CancellationToken ct = default)
    {
        var html = $"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #111827; color: #e5e7eb; padding: 32px; border-radius: 12px;">
              <h2 style="color: #ef4444; margin: 0 0 16px;">Account Locked</h2>
              <p style="margin: 0 0 16px;">Hello {name}, your account has been temporarily locked due to too many failed login attempts. It will be unlocked at {lockoutEnd:g} UTC.</p>
            </div>
            """;
        return SendSmtpAsync(email, "Account Locked — DResume", html);
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
        return SendSmtpAsync(email, "Your Verification Code — DResume", html);
    }

    public Task SendEmailAsync(string to, string? replyTo, string subject, string htmlBody, IEnumerable<EmailAttachment>? attachments = null, CancellationToken ct = default)
        => SendSmtpAsync(to, subject, htmlBody);

    private async Task SendSmtpAsync(string to, string subject, string htmlBody)
    {
        var section = _config.GetSection("DainnUser:Email");
        var host = section["SmtpHost"] ?? "localhost";
        var port = int.Parse(section["SmtpPort"] ?? "1025");
        var fromEmail = section["FromEmail"] ?? "noreply@dresume.local";
        var fromName = section["FromName"] ?? "DResume";
        var username = section["SmtpUsername"] ?? "";
        var password = section["SmtpPassword"] ?? "";
        var enableSsl = bool.Parse(section["EnableSsl"] ?? "false");

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = enableSsl,
            Timeout = 15_000,
            Credentials = string.IsNullOrEmpty(username)
                ? null
                : new NetworkCredential(username, password)
        };

        var msg = new MailMessage
        {
            From = new MailAddress(fromEmail, fromName),
            Subject = subject,
            Body = htmlBody,
            IsBodyHtml = true
        };
        msg.To.Add(to);

        try
        {
            await client.SendMailAsync(msg);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SMTP send to {To} failed (host={Host}:{Port}).", to, host, port);
            throw;
        }
    }
}
