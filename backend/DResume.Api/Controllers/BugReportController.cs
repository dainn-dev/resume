using System.Net;
using DainnUser.Core.Interfaces.Services;
using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using DResume.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/bug-reports")]
public sealed class BugReportController : ControllerBase
{
    private readonly ResumeDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IEmailService _email;
    private readonly IConfiguration _config;
    private readonly ILogger<BugReportController> _logger;

    public BugReportController(
        ResumeDbContext db,
        ICurrentUser current,
        IEmailService email,
        IConfiguration config,
        ILogger<BugReportController> logger)
    {
        _db = db;
        _current = current;
        _email = email;
        _config = config;
        _logger = logger;
    }

    [HttpPost]
    [AllowAnonymous]
    [RequiresRecaptcha]
    public async Task<IActionResult> Submit([FromBody] SubmitBugReportRequest req, CancellationToken ct)
    {
        var title = req.Title?.Trim() ?? string.Empty;
        var description = req.Description?.Trim() ?? string.Empty;

        if (title.Length < 3)
            return BadRequest(ApiResult.Fail("Please provide a short title (at least 3 characters)."));
        if (description.Length < 10)
            return BadRequest(ApiResult.Fail("Please describe the bug in a little more detail."));
        if (title.Length > 200) title = title[..200];
        if (description.Length > 5000) description = description[..5000];

        if (!Enum.IsDefined(typeof(BugSeverity), req.Severity))
            req.Severity = BugSeverity.Medium;

        var userId = _current.UserId;
        var reporterEmail = _current.Email ?? req.Email?.Trim();
        if (!string.IsNullOrWhiteSpace(reporterEmail) && reporterEmail.Length > 256)
            reporterEmail = reporterEmail[..256];

        var report = new BugReport
        {
            UserId = userId,
            ReporterEmail = reporterEmail,
            Title = title,
            Description = description,
            Severity = req.Severity,
            Category = Truncate(req.Category?.Trim(), 40),
            PageUrl = Truncate(req.PageUrl?.Trim(), 2048),
            UserAgent = Truncate(Request.Headers.UserAgent.ToString(), 512),
        };

        _db.BugReports.Add(report);
        await _db.SaveChangesAsync(ct);

        await NotifySupportAsync(report, ct);

        return Ok(ApiResult.Ok(new { report.Id }));
    }

    private async Task NotifySupportAsync(BugReport report, CancellationToken ct)
    {
        var to = _config["Support:BugReportEmail"]
                 ?? _config.GetSection("Admin:Emails").Get<string[]>()?.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(to)) return;

        try
        {
            var severityColor = report.Severity switch
            {
                BugSeverity.Critical => "#ef4444",
                BugSeverity.High => "#f97316",
                BugSeverity.Medium => "#f59e0b",
                _ => "#9ca3af",
            };
            var reporter = WebUtility.HtmlEncode(report.ReporterEmail ?? "Anonymous");
            var html = $"""
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #111827; color: #e5e7eb; border-radius: 12px; overflow: hidden;">
                  <div style="background: {severityColor}; padding: 24px 32px;">
                    <h1 style="color: white; margin: 0; font-size: 20px;">🐞 New Bug Report — {report.Severity}</h1>
                  </div>
                  <div style="padding: 24px 32px;">
                    <h2 style="margin: 0 0 12px; font-size: 18px; color: white;">{WebUtility.HtmlEncode(report.Title)}</h2>
                    <p style="margin: 0 0 20px; white-space: pre-wrap; color: #d1d5db; font-size: 14px; line-height: 1.6;">{WebUtility.HtmlEncode(report.Description)}</p>
                    <table style="width: 100%; font-size: 13px; color: #9ca3af; border-collapse: collapse;">
                      <tr><td style="padding: 4px 0; width: 120px;">Reporter</td><td style="color: #e5e7eb;">{reporter}</td></tr>
                      <tr><td style="padding: 4px 0;">Category</td><td style="color: #e5e7eb;">{WebUtility.HtmlEncode(report.Category ?? "—")}</td></tr>
                      <tr><td style="padding: 4px 0;">Page</td><td style="color: #e5e7eb; word-break: break-all;">{WebUtility.HtmlEncode(report.PageUrl ?? "—")}</td></tr>
                      <tr><td style="padding: 4px 0;">User ID</td><td style="color: #e5e7eb;">{report.UserId?.ToString() ?? "—"}</td></tr>
                      <tr><td style="padding: 4px 0;">Submitted</td><td style="color: #e5e7eb;">{report.CreatedAt:u}</td></tr>
                    </table>
                  </div>
                </div>
                """;

            await _email.SendEmailAsync(to, report.ReporterEmail, $"[Bug · {report.Severity}] {report.Title}", html, null, ct);
        }
        catch (Exception ex)
        {
            // A failed notification must not fail the user's submission — the report is already persisted.
            _logger.LogWarning(ex, "Failed to send bug report notification email for report {ReportId}.", report.Id);
        }
    }

    private static string? Truncate(string? value, int max)
        => string.IsNullOrEmpty(value) ? value : (value.Length <= max ? value : value[..max]);
}
