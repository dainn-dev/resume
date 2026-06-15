using System.Text;
using DainnUser.Core.Entities;
using DainnUser.Core.Interfaces.Services;
using DainnUser.Infrastructure.Data;
using DResume.Api.Billing;
using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using DResume.Api.Features.Portfolio;
using DResume.Api.Features.Resumes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize]
[RequiresAdmin]
public sealed class AdminController : ControllerBase
{
    private readonly DainnUserDbContext _userDb;
    private readonly ResumeDbContext _resumeDb;
    private readonly IPlanService _plans;
    private readonly IProfileService _profile;
    private readonly IAuthenticationService _auth;
    private readonly ICurrentUser _current;
    private static readonly PasswordHasher<User> _hasher = new();

    public AdminController(
        DainnUserDbContext userDb,
        ResumeDbContext resumeDb,
        IPlanService plans,
        IProfileService profile,
        IAuthenticationService auth,
        ICurrentUser current)
    {
        _userDb = userDb;
        _resumeDb = resumeDb;
        _plans = plans;
        _profile = profile;
        _auth = auth;
        _current = current;
    }

    [HttpGet("users")]
    public async Task<IActionResult> ListUsers(
        [FromQuery] int page = 1,
        [FromQuery] int size = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? plan = null,
        [FromQuery] string? status = null,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        size = Math.Clamp(size, 1, 100);

        var query = await BuildFilteredUsersAsync(search, plan, status, null, ct);

        var total = await query.CountAsync(ct);
        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * size)
            .Take(size)
            .Select(u => new
            {
                u.Id,
                u.Email,
                u.Username,
                u.EmailVerified,
                u.Status,
                u.FailedLoginAttempts,
                u.LockoutEnd,
                u.CreatedAt,
                u.LastLoginAt,
            })
            .ToListAsync(ct);

        var userIds = users.Select(u => u.Id).ToList();
        var subs = await _resumeDb.UserSubscriptions
            .AsNoTracking()
            .Where(s => userIds.Contains(s.UserId))
            .ToDictionaryAsync(s => s.UserId, ct);

        var resumeCounts = await _resumeDb.Resumes
            .AsNoTracking()
            .Where(r => userIds.Contains(r.UserId))
            .GroupBy(r => r.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.UserId, x => x.Count, ct);

        var rows = users.Select(u => new
        {
            u.Id,
            u.Email,
            u.Username,
            u.EmailVerified,
            status = u.Status.ToString(),
            isLocked = u.LockoutEnd.HasValue && u.LockoutEnd.Value > DateTime.UtcNow,
            u.LockoutEnd,
            u.CreatedAt,
            u.LastLoginAt,
            plan = subs.TryGetValue(u.Id, out var sub) ? sub.PlanCode.ToString() : "Free",
            subStatus = subs.TryGetValue(u.Id, out var s2) ? s2.Status : null,
            resumeCount = resumeCounts.GetValueOrDefault(u.Id, 0),
        });

        return Ok(ApiResult.Ok(new { total, page, size, users = rows }));
    }

    // Shared user filtering for the list + export endpoints. Plan lives in resumeDb (a different
    // DbContext/DB than userDb), so we can't SQL-join it — instead we pull the matching user ids
    // and filter the userDb query with them.
    private async Task<IQueryable<User>> BuildFilteredUsersAsync(
        string? search, string? plan, string? status, List<Guid>? ids, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var query = _userDb.Users.AsNoTracking();

        if (ids is { Count: > 0 })
            query = query.Where(u => ids.Contains(u.Id));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(u => u.Email.ToLower().Contains(s) || u.Username.ToLower().Contains(s));
        }

        if (string.Equals(status, "locked", StringComparison.OrdinalIgnoreCase))
            query = query.Where(u => u.LockoutEnd != null && u.LockoutEnd > now);
        else if (string.Equals(status, "active", StringComparison.OrdinalIgnoreCase))
            query = query.Where(u => u.LockoutEnd == null || u.LockoutEnd <= now);
        else if (string.Equals(status, "unverified", StringComparison.OrdinalIgnoreCase))
            query = query.Where(u => !u.EmailVerified);

        if (Enum.TryParse<PlanCode>(plan, true, out var planCode))
        {
            if (planCode == PlanCode.Free)
            {
                // Free = anyone who is NOT an active paid subscriber.
                var paidIds = await _resumeDb.UserSubscriptions.AsNoTracking()
                    .Where(s => (s.Status == "active" || s.Status == "trialing") && s.PlanCode != PlanCode.Free)
                    .Select(s => s.UserId).ToListAsync(ct);
                query = query.Where(u => !paidIds.Contains(u.Id));
            }
            else
            {
                var planIds = await _resumeDb.UserSubscriptions.AsNoTracking()
                    .Where(s => (s.Status == "active" || s.Status == "trialing") && s.PlanCode == planCode)
                    .Select(s => s.UserId).ToListAsync(ct);
                query = query.Where(u => planIds.Contains(u.Id));
            }
        }

        return query;
    }

    [HttpGet("users/export")]
    public async Task<IActionResult> ExportUsers(
        [FromQuery] string? search = null,
        [FromQuery] string? plan = null,
        [FromQuery] string? status = null,
        [FromQuery] string? ids = null,
        CancellationToken ct = default)
    {
        var idList = (ids ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => Guid.TryParse(x, out var g) ? g : (Guid?)null)
            .Where(g => g.HasValue).Select(g => g!.Value).ToList();

        var query = await BuildFilteredUsersAsync(search, plan, status, idList.Count > 0 ? idList : null, ct);
        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Take(5000) // safety cap
            .Select(u => new { u.Id, u.Email, u.Username, u.EmailVerified, u.Status, u.LockoutEnd, u.CreatedAt, u.LastLoginAt })
            .ToListAsync(ct);

        var userIds = users.Select(u => u.Id).ToList();
        var subs = await _resumeDb.UserSubscriptions.AsNoTracking()
            .Where(s => userIds.Contains(s.UserId)).ToDictionaryAsync(s => s.UserId, ct);
        var resumeCounts = await _resumeDb.Resumes.AsNoTracking()
            .Where(r => userIds.Contains(r.UserId)).GroupBy(r => r.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.UserId, x => x.Count, ct);

        var now = DateTime.UtcNow;
        var sb = new StringBuilder();
        sb.Append('﻿'); // UTF-8 BOM so Excel reads diacritics correctly
        sb.AppendLine("Email,Username,EmailVerified,Status,Locked,Plan,SubStatus,Resumes,CreatedAt,LastLoginAt");
        foreach (var u in users)
        {
            var locked = u.LockoutEnd.HasValue && u.LockoutEnd.Value > now;
            var planName = subs.TryGetValue(u.Id, out var sub) ? sub.PlanCode.ToString() : "Free";
            var subStatus = subs.TryGetValue(u.Id, out var s2) ? s2.Status : "";
            var cols = new[]
            {
                u.Email, u.Username, u.EmailVerified ? "yes" : "no", u.Status.ToString(),
                locked ? "yes" : "no", planName, subStatus ?? "",
                resumeCounts.GetValueOrDefault(u.Id, 0).ToString(),
                u.CreatedAt.ToString("u"),
                u.LastLoginAt?.ToString("u") ?? "",
            };
            sb.AppendLine(string.Join(",", cols.Select(Csv)));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv; charset=utf-8", $"users-{now:yyyyMMdd-HHmmss}.csv");
    }

    // Quote a CSV field and escape embedded quotes (RFC 4180).
    private static string Csv(string? value)
    {
        var v = value ?? "";
        return $"\"{v.Replace("\"", "\"\"")}\"";
    }

    [HttpGet("resumes/{resumeId:guid}/file")]
    public async Task<IActionResult> DownloadResume(
        Guid resumeId, [FromServices] IFileStorageService files, [FromQuery] bool inline = false, CancellationToken ct = default)
    {
        var resume = await _resumeDb.Resumes.AsNoTracking().FirstOrDefaultAsync(r => r.Id == resumeId, ct)
            ?? throw new KeyNotFoundException("Resume not found.");

        // Prefer the original uploaded file; fall back to the extracted text as a .txt download.
        if (!string.IsNullOrEmpty(resume.StoredFilePath))
        {
            var stream = files.OpenRead(resume.StoredFilePath);
            var contentType = resume.FileContentType ?? "application/octet-stream";
            var fileName = resume.SourceFileName ?? $"resume-{resumeId}";
            return inline ? File(stream, contentType, enableRangeProcessing: true) : File(stream, contentType, fileName);
        }

        var textBytes = Encoding.UTF8.GetBytes(resume.RawText ?? "");
        var txtName = $"{(string.IsNullOrWhiteSpace(resume.Title) ? "resume" : resume.Title)}.txt";
        return File(textBytes, "text/plain; charset=utf-8", txtName);
    }

    [HttpGet("users/{id:guid}")]
    public async Task<IActionResult> GetUser(Guid id, CancellationToken ct)
    {
        var user = await _userDb.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new KeyNotFoundException("User not found.");

        var profile = await _profile.GetProfileAsync(id, ct);
        var sub = await _resumeDb.UserSubscriptions.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == id, ct);

        var resumes = await _resumeDb.Resumes
            .AsNoTracking()
            .Where(r => r.UserId == id)
            .OrderByDescending(r => r.UpdatedAt)
            .Select(r => new
            {
                r.Id,
                r.Title,
                r.SourceFileName,
                r.CreatedAt,
                r.UpdatedAt,
                hasParsedData = r.ParsedDataJson != null,
                hasFile = r.StoredFilePath != null,
                latestAnalysis = _resumeDb.ResumeAnalyses
                    .Where(a => a.ResumeId == r.Id)
                    .OrderByDescending(a => a.CreatedAt)
                    .Select(a => new { a.Id, a.Score, a.CreatedAt })
                    .FirstOrDefault(),
            })
            .Take(50)
            .ToListAsync(ct);

        var totals = new
        {
            resumes = await _resumeDb.Resumes.CountAsync(r => r.UserId == id, ct),
            jobMatches = await _resumeDb.JobMatches.CountAsync(j => j.UserId == id, ct),
            coverLetters = await _resumeDb.CoverLetters.CountAsync(c => c.UserId == id, ct),
            careerCoach = await _resumeDb.CareerCoachSessions.CountAsync(c => c.UserId == id, ct),
            interviewCoach = await _resumeDb.InterviewCoachSessions.CountAsync(c => c.UserId == id, ct),
            salaryEstimates = await _resumeDb.SalaryEstimates.CountAsync(s => s.UserId == id, ct),
        };

        return Ok(ApiResult.Ok(new
        {
            user = new
            {
                user.Id, user.Email, user.Username, user.EmailVerified,
                status = user.Status.ToString(),
                isLocked = user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTime.UtcNow,
                user.LockoutEnd,
                user.FailedLoginAttempts,
                user.CreatedAt,
                user.UpdatedAt,
                user.LastLoginAt,
            },
            profile = profile is null ? null : new
            {
                profile.FirstName, profile.LastName, profile.DisplayName,
                profile.AvatarUrl, profile.Language, profile.Timezone, profile.Bio, profile.Website,
            },
            subscription = sub is null ? null : new
            {
                plan = sub.PlanCode.ToString(),
                sub.Status,
                sub.CancelAtPeriodEnd,
                sub.CurrentPeriodEnd,
                sub.StripeCustomerId,
                sub.StripeSubscriptionId,
                sub.UpdatedAt,
                sub.IsAdminGranted,
                sub.GrantedByEmail,
                sub.GrantedAt,
                sub.GrantNote,
            },
            totals,
            resumes,
            invoices = (object?)null,
        }));
    }

    public sealed record GrantPlanRequest(string PlanCode, int? DurationMonths, string? Note);

    [HttpPost("users/{id:guid}/plan")]
    public async Task<IActionResult> GrantPlan(Guid id, [FromBody] GrantPlanRequest req, [FromServices] IBillingNotifier notifier, CancellationToken ct)
    {
        if (!Enum.TryParse<PlanCode>(req.PlanCode, true, out var planCode))
            return BadRequest(ApiResult.Fail("Invalid plan code. Use Free, Pro, or Premium."));

        // Duration: 0 = permanent (no expiry), default 12 months. Valid values: 0/1/3/6/12/24.
        var months = req.DurationMonths ?? 12;
        DateTime? expiresAt = (planCode == PlanCode.Free || months == 0) ? null : DateTime.UtcNow.AddMonths(months);
        var adminEmail = _current.Email ?? "admin";

        await _plans.GrantPlanAsync(id, planCode, adminEmail, expiresAt, req.Note, ct);

        // Notify granted user (skip for Free which is effectively a revoke)
        if (planCode != PlanCode.Free)
        {
            var user = await _userDb.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct);
            if (user is not null && !string.IsNullOrWhiteSpace(user.Email))
            {
                await notifier.SendAdminGrantedAsync(
                    user.Email,
                    string.IsNullOrWhiteSpace(user.Username) ? "there" : user.Username,
                    PlanCatalog.Get(planCode),
                    expiresAt,
                    req.Note,
                    ct);
            }
        }

        return Ok(ApiResult.Ok(new
        {
            granted = true,
            plan = planCode.ToString(),
            expiresAt,
            durationMonths = months,
            grantedBy = adminEmail,
        }));
    }

    public sealed record LockoutRequest(bool Locked, int? Minutes);

    [HttpPost("users/{id:guid}/lockout")]
    public async Task<IActionResult> SetLockout(Guid id, [FromBody] LockoutRequest req, CancellationToken ct)
    {
        var user = await _userDb.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new KeyNotFoundException("User not found.");

        if (req.Locked)
        {
            var minutes = req.Minutes ?? 60 * 24 * 365; // default 1 year
            user.LockoutEnd = DateTime.UtcNow.AddMinutes(minutes);
        }
        else
        {
            user.LockoutEnd = null;
            user.FailedLoginAttempts = 0;
        }
        user.UpdatedAt = DateTime.UtcNow;
        await _userDb.SaveChangesAsync(ct);

        return Ok(ApiResult.Ok(new { locked = req.Locked, lockoutEnd = user.LockoutEnd }));
    }

    public sealed record ResetPasswordRequest(string Mode);

    [HttpPost("users/{id:guid}/reset-password")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordRequest req, CancellationToken ct)
    {
        var user = await _userDb.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new KeyNotFoundException("User not found.");

        var mode = (req.Mode ?? "email").ToLowerInvariant();

        if (mode == "email")
        {
            await _auth.ForgotPasswordAsync(user.Email, ct);
            return Ok(ApiResult.Ok(new
            {
                mode = "email",
                sent = true,
                email = user.Email,
                message = $"Password reset email sent to {user.Email}.",
            }));
        }

        if (mode == "temp")
        {
            var tempPassword = GenerateTempPassword();
            user.PasswordHash = _hasher.HashPassword(user, tempPassword);
            user.FailedLoginAttempts = 0;
            user.LockoutEnd = null;
            user.UpdatedAt = DateTime.UtcNow;
            await _userDb.SaveChangesAsync(ct);

            // Best-effort revoke any active sessions so user must re-login
            try
            {
                var sessions = HttpContext.RequestServices.GetService<ISessionService>();
                if (sessions is not null)
                    await sessions.RevokeAllSessionsAsync(id, ct);
            }
            catch { /* swallow */ }

            return Ok(ApiResult.Ok(new
            {
                mode = "temp",
                tempPassword,
                message = "Temporary password generated. Share with user via a secure channel — they must change it after login.",
            }));
        }

        return BadRequest(ApiResult.Fail("Invalid mode. Use 'email' or 'temp'."));
    }

    private static string GenerateTempPassword()
    {
        // 14 chars, mix upper+lower+digits+symbols, easy to type
        const string upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
        const string lower = "abcdefghjkmnpqrstuvwxyz";
        const string digits = "23456789";
        const string symbols = "!@#$%^&*";
        var all = upper + lower + digits + symbols;
        var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
        var bytes = new byte[14];
        rng.GetBytes(bytes);
        var chars = new char[14];
        // Ensure at least one of each class
        chars[0] = upper[bytes[0] % upper.Length];
        chars[1] = lower[bytes[1] % lower.Length];
        chars[2] = digits[bytes[2] % digits.Length];
        chars[3] = symbols[bytes[3] % symbols.Length];
        for (int i = 4; i < 14; i++) chars[i] = all[bytes[i] % all.Length];
        // Shuffle
        for (int i = 13; i > 0; i--)
        {
            var j = bytes[i] % (i + 1);
            (chars[i], chars[j]) = (chars[j], chars[i]);
        }
        return new string(chars);
    }

    [HttpDelete("users/{id:guid}")]
    public async Task<IActionResult> DeleteUser(Guid id, [FromServices] IPortfolioService portfolioService, CancellationToken ct)
    {
        if (_current.UserId == id)
            return BadRequest(ApiResult.Fail("Cannot delete your own account."));

        var user = await _userDb.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new KeyNotFoundException("User not found.");

        // Guard: never delete another admin
        var conn = _userDb.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync(ct);
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText =
                "SELECT 1 FROM \"UserRoles\" ur " +
                "INNER JOIN \"Roles\" r ON r.\"Id\" = ur.\"RoleId\" " +
                "WHERE ur.\"UserId\" = @id AND r.\"Name\" = 'Administrator'";
            var p = cmd.CreateParameter();
            p.ParameterName = "id";
            p.Value = id;
            cmd.Parameters.Add(p);
            if (await cmd.ExecuteScalarAsync(ct) is not null)
                return BadRequest(ApiResult.Fail("Cannot delete an administrator account."));
        }

        var email = user.Email;

        // Delete resume-related data (order matters: children before parents)
        var resumeIds = await _resumeDb.Resumes.Where(r => r.UserId == id).Select(r => r.Id).ToListAsync(ct);
        if (resumeIds.Count > 0)
            await _resumeDb.ResumeAnalyses.Where(a => resumeIds.Contains(a.ResumeId)).ExecuteDeleteAsync(ct);

        await _resumeDb.Resumes.Where(r => r.UserId == id).ExecuteDeleteAsync(ct);
        await _resumeDb.JobMatches.Where(j => j.UserId == id).ExecuteDeleteAsync(ct);
        await _resumeDb.CoverLetters.Where(c => c.UserId == id).ExecuteDeleteAsync(ct);
        await _resumeDb.CareerCoachSessions.Where(c => c.UserId == id).ExecuteDeleteAsync(ct);
        await _resumeDb.InterviewCoachSessions.Where(i => i.UserId == id).ExecuteDeleteAsync(ct);
        await _resumeDb.SalaryEstimates.Where(s => s.UserId == id).ExecuteDeleteAsync(ct);
        await _resumeDb.ResumeBuilds.Where(rb => rb.UserId == id).ExecuteDeleteAsync(ct);
        await _resumeDb.AiUsages.Where(a => a.UserId == id).ExecuteDeleteAsync(ct);
        await _resumeDb.BankPayments.Where(b => b.UserId == id).ExecuteDeleteAsync(ct);
        await _resumeDb.BugReports.Where(b => b.UserId == id).ExecuteDeleteAsync(ct);

        // Calendar: tasks → milestones → goals
        var goalIds = await _resumeDb.CalendarGoals.Where(g => g.UserId == id).Select(g => g.Id).ToListAsync(ct);
        if (goalIds.Count > 0)
        {
            var milestoneIds = await _resumeDb.CalendarMilestones.Where(m => goalIds.Contains(m.GoalId)).Select(m => m.Id).ToListAsync(ct);
            if (milestoneIds.Count > 0)
                await _resumeDb.CalendarTasks.Where(t => milestoneIds.Contains(t.MilestoneId)).ExecuteDeleteAsync(ct);
            await _resumeDb.CalendarMilestones.Where(m => goalIds.Contains(m.GoalId)).ExecuteDeleteAsync(ct);
            await _resumeDb.CalendarGoals.Where(g => goalIds.Contains(g.Id)).ExecuteDeleteAsync(ct);
        }

        await _resumeDb.UserSubscriptions.Where(s => s.UserId == id).ExecuteDeleteAsync(ct);

        // Portfolio (may not exist — swallow not-found)
        try { await portfolioService.DeleteAsync(id, ct); } catch (KeyNotFoundException) { }

        // Remove from DainnUser: clean up roles then remove the user entity
        await _userDb.Database.ExecuteSqlRawAsync(
            "DELETE FROM \"UserRoles\" WHERE \"UserId\" = {0}", id);
        _userDb.Users.Remove(user);
        await _userDb.SaveChangesAsync(ct);

        return Ok(ApiResult.Ok(new { deleted = true, userId = id, email }));
    }

    [HttpDelete("resumes/{resumeId:guid}")]
    public async Task<IActionResult> DeleteResume(Guid resumeId, CancellationToken ct)
    {
        var resume = await _resumeDb.Resumes.FirstOrDefaultAsync(r => r.Id == resumeId, ct)
            ?? throw new KeyNotFoundException("Resume not found.");

        _resumeDb.Resumes.Remove(resume);
        await _resumeDb.SaveChangesAsync(ct);

        return Ok(ApiResult.Ok(new { deleted = true, resumeId }));
    }

    [HttpGet("portfolios")]
    public async Task<IActionResult> ListPortfolios(
        [FromServices] IPortfolioService portfolios,
        [FromQuery] string? status,
        CancellationToken ct = default)
    {
        PortfolioStatus? filter = Enum.TryParse<PortfolioStatus>(status, true, out var s) ? s : null;
        var items = await portfolios.ListForAdminAsync(filter, ct);

        var userIds = items.Select(p => p.UserId).Distinct().ToList();
        var emails = await _userDb.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Email, ct);

        var rows = items.Select(p => p with { UserEmail = emails.GetValueOrDefault(p.UserId) });
        return Ok(ApiResult.Ok(rows));
    }

    [HttpGet("portfolios/{id:guid}/preview")]
    public async Task<IActionResult> PreviewPortfolio(Guid id, [FromServices] IPortfolioService portfolios, CancellationToken ct)
    {
        var dto = await portfolios.GetPreviewAsync(id, ct);
        if (dto is null) throw new KeyNotFoundException("Portfolio not found.");
        return Ok(ApiResult.Ok(dto));
    }

    [HttpPost("portfolios/{id:guid}/approve")]
    public async Task<IActionResult> ApprovePortfolio(Guid id, [FromServices] IPortfolioService portfolios, CancellationToken ct)
    {
        await portfolios.ApproveAsync(id, _current.Email ?? "admin", ct);
        return Ok(ApiResult.Ok(new { approved = true, id }));
    }

    [HttpPost("portfolios/{id:guid}/reject")]
    public async Task<IActionResult> RejectPortfolio(Guid id, [FromBody] RejectPortfolioRequest req,
        [FromServices] IPortfolioService portfolios, CancellationToken ct)
    {
        await portfolios.RejectAsync(id, _current.Email ?? "admin", req?.Reason ?? "", ct);
        return Ok(ApiResult.Ok(new { rejected = true, id }));
    }

    [HttpGet("plans")]
    public async Task<IActionResult> ListPlans([FromServices] IPlanCatalogService catalog,
        [FromServices] IBankPricingService pricing, CancellationToken ct)
    {
        var plans = await catalog.GetAllAsync(ct);
        var records = await _resumeDb.Plans.AsNoTracking().OrderBy(p => p.Code).ToListAsync(ct);
        var view = new List<object>();
        foreach (var p in plans)
        {
            var r = records.FirstOrDefault(x => x.Code == p.Code);
            var tiers = p.IsPaid
                ? (await pricing.GetAllTiersAsync(p.Code, ct))
                    .Select(t => new
                    {
                        id = t.Id, months = t.Months, discountPercent = t.DiscountPercent, active = t.Active,
                        startDate = t.StartDate, endDate = t.EndDate, maxRedemptions = t.MaxRedemptions, redemptions = t.Redemptions,
                    })
                : Enumerable.Empty<object>();
            view.Add(new
            {
                code = p.Code.ToString(),
                lookupKey = p.LookupKey,
                name = p.Name,
                description = p.Description,
                monthlyPriceCents = p.MonthlyPriceCents,
                currency = p.Currency,
                monthlyPriceVnd = p.MonthlyPriceVnd,
                bankTiers = tiers,
                limits = new
                {
                    maxResumes = p.Limits.MaxResumes,
                    monthlyAiCalls = p.Limits.MonthlyAiCalls,
                    p.Limits.JobMatchEnabled,
                    p.Limits.CoverLetterEnabled,
                    p.Limits.CareerCoachEnabled,
                    p.Limits.InterviewCoachEnabled,
                    p.Limits.SalaryEstimatorEnabled,
                    p.Limits.CalendarEnabled,
                    p.Limits.CompanyReviewEnabled,
                    p.Limits.PriorityQueue,
                },
                updatedAt = r?.UpdatedAt,
            });
        }
        return Ok(ApiResult.Ok(view));
    }

    [HttpPatch("plans/{code}")]
    public async Task<IActionResult> UpdatePlan(string code, [FromBody] UpdatePlanRequest req,
        [FromServices] IPlanCatalogService catalog, CancellationToken ct)
    {
        if (!Enum.TryParse<PlanCode>(code, true, out var planCode))
            return BadRequest(ApiResult.Fail("Invalid plan code."));
        var updated = await catalog.UpdatePlanAsync(planCode, req, ct);
        return Ok(ApiResult.Ok(new { updated = true, plan = updated.Name }));
    }

    // ───────── Bank-transfer pricing tiers (per plan) ─────────

    [HttpGet("plans/{code}/bank-tiers")]
    public async Task<IActionResult> ListBankTiers(string code,
        [FromServices] IBankPricingService pricing, CancellationToken ct)
    {
        if (!Enum.TryParse<PlanCode>(code, true, out var planCode))
            return BadRequest(ApiResult.Fail("Invalid plan code."));
        var tiers = await pricing.GetAllTiersAsync(planCode, ct);
        return Ok(ApiResult.Ok(tiers.Select(t => new
        {
            id = t.Id, months = t.Months, discountPercent = t.DiscountPercent, active = t.Active,
            startDate = t.StartDate, endDate = t.EndDate, maxRedemptions = t.MaxRedemptions, redemptions = t.Redemptions,
        })));
    }

    public sealed record AddBankTierRequest(int Months, int DiscountPercent, DateTime? StartDate, DateTime? EndDate, int? MaxRedemptions);

    [HttpPost("plans/{code}/bank-tiers")]
    public async Task<IActionResult> AddBankTier(string code, [FromBody] AddBankTierRequest req,
        [FromServices] IBankPricingService pricing, CancellationToken ct)
    {
        if (!Enum.TryParse<PlanCode>(code, true, out var planCode))
            return BadRequest(ApiResult.Fail("Invalid plan code."));
        var tier = await pricing.AddTierAsync(planCode, req.Months, req.DiscountPercent, req.StartDate, req.EndDate, req.MaxRedemptions, ct);
        return Ok(ApiResult.Ok(new { id = tier.Id, months = tier.Months, discountPercent = tier.DiscountPercent, active = tier.Active, startDate = tier.StartDate, endDate = tier.EndDate, maxRedemptions = tier.MaxRedemptions, redemptions = tier.Redemptions }));
    }

    public sealed record UpdateBankTierRequest(int? DiscountPercent, bool? Active, DateTime? StartDate, DateTime? EndDate, int? MaxRedemptions, bool ClearStartDate = false, bool ClearEndDate = false, bool ClearMaxRedemptions = false);

    [HttpPatch("plans/{code}/bank-tiers/{id:guid}")]
    public async Task<IActionResult> UpdateBankTier(string code, Guid id, [FromBody] UpdateBankTierRequest req,
        [FromServices] IBankPricingService pricing, CancellationToken ct)
    {
        var tier = await pricing.UpdateTierAsync(id, req.DiscountPercent, req.Active, req.StartDate, req.EndDate, req.MaxRedemptions, req.ClearStartDate, req.ClearEndDate, req.ClearMaxRedemptions, ct);
        return Ok(ApiResult.Ok(new { id = tier.Id, months = tier.Months, discountPercent = tier.DiscountPercent, active = tier.Active, startDate = tier.StartDate, endDate = tier.EndDate, maxRedemptions = tier.MaxRedemptions, redemptions = tier.Redemptions }));
    }

    [HttpDelete("plans/{code}/bank-tiers/{id:guid}")]
    public async Task<IActionResult> DeleteBankTier(string code, Guid id,
        [FromServices] IBankPricingService pricing, CancellationToken ct)
    {
        await pricing.DeleteTierAsync(id, ct);
        return Ok(ApiResult.Ok(new { deleted = true, id }));
    }

    [HttpGet("analytics")]
    public async Task<IActionResult> Analytics([FromQuery] int days = 30, CancellationToken ct = default)
    {
        days = Math.Clamp(days, 7, 90);
        var since = DateTime.UtcNow.Date.AddDays(-days + 1);
        var today = DateTime.UtcNow.Date;

        // Aggregate totals (parallel queries)
        var totalUsers = await _userDb.Users.CountAsync(ct);
        var verifiedUsers = await _userDb.Users.CountAsync(u => u.EmailVerified, ct);

        var planCountsRaw = await _resumeDb.UserSubscriptions
            .AsNoTracking()
            .Where(s => !s.IsAdminGranted)
            .GroupBy(s => s.PlanCode)
            .Select(g => new { Plan = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var grantedCount = await _resumeDb.UserSubscriptions
            .AsNoTracking()
            .Where(s => s.IsAdminGranted && s.PlanCode != PlanCode.Free)
            .CountAsync(ct);
        var planDistribution = planCountsRaw
            .Select(x => new { plan = x.Plan.ToString(), count = x.Count })
            .ToList();
        // include Free (everyone without a row counts as Free)
        var trackedUserCount = planCountsRaw.Sum(x => x.Count);
        var untrackedFree = Math.Max(0, totalUsers - trackedUserCount);
        if (untrackedFree > 0)
        {
            var existingFree = planDistribution.FirstOrDefault(p => p.plan == "Free");
            if (existingFree is null)
                planDistribution.Add(new { plan = "Free", count = untrackedFree });
            else
            {
                planDistribution.RemoveAll(p => p.plan == "Free");
                planDistribution.Add(new { plan = "Free", count = existingFree.count + untrackedFree });
            }
        }

        var paidUsers = planCountsRaw.Where(x => x.Plan != PlanCode.Free).Sum(x => x.Count);

        var totals = new
        {
            users = totalUsers,
            verifiedUsers,
            paidUsers,
            freeUsers = totalUsers - paidUsers,
            resumes = await _resumeDb.Resumes.CountAsync(ct),
            analyses = await _resumeDb.ResumeAnalyses.CountAsync(ct),
            jobMatches = await _resumeDb.JobMatches.CountAsync(ct),
            coverLetters = await _resumeDb.CoverLetters.CountAsync(ct),
            careerCoach = await _resumeDb.CareerCoachSessions.CountAsync(ct),
            interviewCoach = await _resumeDb.InterviewCoachSessions.CountAsync(ct),
            salaryEstimates = await _resumeDb.SalaryEstimates.CountAsync(ct),
        };

        // Signups by day
        var signupsRaw = await _userDb.Users
            .AsNoTracking()
            .Where(u => u.CreatedAt >= since)
            .Select(u => u.CreatedAt.Date)
            .ToListAsync(ct);
        var signupsByDay = FillDailySeries(since, today, signupsRaw);

        // Feature usage by day — join all feature tables, count by date
        var resumesByDay = await CountByDay(_resumeDb.Resumes.AsNoTracking().Where(r => r.CreatedAt >= since).Select(r => r.CreatedAt.Date), ct);
        var analysesByDay = await CountByDay(_resumeDb.ResumeAnalyses.AsNoTracking().Where(r => r.CreatedAt >= since).Select(r => r.CreatedAt.Date), ct);
        var jobMatchesByDay = await CountByDay(_resumeDb.JobMatches.AsNoTracking().Where(r => r.CreatedAt >= since).Select(r => r.CreatedAt.Date), ct);
        var coverLettersByDay = await CountByDay(_resumeDb.CoverLetters.AsNoTracking().Where(r => r.CreatedAt >= since).Select(r => r.CreatedAt.Date), ct);
        var careerCoachByDay = await CountByDay(_resumeDb.CareerCoachSessions.AsNoTracking().Where(r => r.CreatedAt >= since).Select(r => r.CreatedAt.Date), ct);
        var interviewCoachByDay = await CountByDay(_resumeDb.InterviewCoachSessions.AsNoTracking().Where(r => r.CreatedAt >= since).Select(r => r.CreatedAt.Date), ct);
        var salaryByDay = await CountByDay(_resumeDb.SalaryEstimates.AsNoTracking().Where(r => r.CreatedAt >= since).Select(r => r.CreatedAt.Date), ct);

        var featureUsageByDay = new List<object>();
        for (var d = since; d <= today; d = d.AddDays(1))
        {
            featureUsageByDay.Add(new
            {
                date = d.ToString("yyyy-MM-dd"),
                resumes = resumesByDay.GetValueOrDefault(d, 0),
                analyses = analysesByDay.GetValueOrDefault(d, 0),
                jobMatches = jobMatchesByDay.GetValueOrDefault(d, 0),
                coverLetters = coverLettersByDay.GetValueOrDefault(d, 0),
                careerCoach = careerCoachByDay.GetValueOrDefault(d, 0),
                interviewCoach = interviewCoachByDay.GetValueOrDefault(d, 0),
                salaryEstimates = salaryByDay.GetValueOrDefault(d, 0),
            });
        }

        // Score distribution (histogram buckets)
        var allScores = await _resumeDb.ResumeAnalyses.AsNoTracking().Select(a => a.Score).ToListAsync(ct);
        var scoreBuckets = new[] { (0, 19), (20, 39), (40, 59), (60, 79), (80, 100) }
            .Select(b => new { range = $"{b.Item1}-{b.Item2}", count = allScores.Count(s => s >= b.Item1 && s <= b.Item2) })
            .ToList();

        // Revenue: monthly recurring (active paid subs × plan price)
        var planPrices = new Dictionary<PlanCode, long> { { PlanCode.Pro, 499 }, { PlanCode.Premium, 999 } };
        long mrr = 0;
        var revenueByPlan = new List<object>();
        foreach (var p in planCountsRaw)
        {
            if (planPrices.TryGetValue(p.Plan, out var cents))
            {
                var planRevenue = (long)p.Count * cents;
                mrr += planRevenue;
                revenueByPlan.Add(new { plan = p.Plan.ToString(), count = p.Count, revenueCents = planRevenue });
            }
        }

        return Ok(ApiResult.Ok(new
        {
            totals,
            planDistribution,
            grantedCount,
            signupsByDay,
            featureUsageByDay,
            scoreBuckets,
            revenue = new { mrrCents = mrr, byPlan = revenueByPlan },
        }));
    }

    private static async Task<Dictionary<DateTime, int>> CountByDay(IQueryable<DateTime> dates, CancellationToken ct)
    {
        var list = await dates.ToListAsync(ct);
        return list.GroupBy(d => d).ToDictionary(g => g.Key, g => g.Count());
    }

    private static List<object> FillDailySeries(DateTime since, DateTime today, List<DateTime> raw)
    {
        var counts = raw.GroupBy(d => d).ToDictionary(g => g.Key, g => g.Count());
        var result = new List<object>();
        for (var d = since; d <= today; d = d.AddDays(1))
            result.Add(new { date = d.ToString("yyyy-MM-dd"), count = counts.GetValueOrDefault(d, 0) });
        return result;
    }
}
