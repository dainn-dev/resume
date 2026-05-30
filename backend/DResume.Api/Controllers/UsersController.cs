using System.Text.Json;
using DainnUser.Core.Interfaces.Services;
using DainnUser.Core.Models.Profile;
using DResume.Api.Billing;
using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public sealed class UsersController : ControllerBase
{
    private readonly IProfileService _profile;
    private readonly ISessionService _sessions;
    private readonly ICurrentUser _current;
    private readonly ResumeDbContext _db;
    private readonly IPlanService _plans;
    private readonly IUsageService _usage;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public UsersController(
        IProfileService profile,
        ISessionService sessions,
        ICurrentUser current,
        ResumeDbContext db,
        IPlanService plans,
        IUsageService usage)
    {
        _profile = profile;
        _sessions = sessions;
        _current = current;
        _db = db;
        _plans = plans;
        _usage = usage;
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var profile = await _profile.GetProfileAsync(_current.RequireUserId(), ct);
        return Ok(ApiResult.Ok(profile));
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateMe([FromBody] UpdateProfileRequest req, CancellationToken ct)
    {
        var dto = new UpdateProfileDto
        {
            FirstName = req.FirstName ?? string.Empty,
            LastName = req.LastName ?? string.Empty,
            DisplayName = req.DisplayName ?? string.Empty,
            Bio = req.Bio ?? string.Empty,
            Language = req.Language ?? string.Empty,
            Timezone = req.Timezone ?? string.Empty,
            AvatarUrl = req.AvatarUrl ?? string.Empty,
            Website = req.Website ?? string.Empty,
            Gender = req.Gender ?? string.Empty,
            DateOfBirth = req.DateOfBirth,
        };
        var updated = await _profile.UpdateProfileAsync(_current.RequireUserId(), dto, ct);
        return Ok(ApiResult.Ok(updated));
    }

    [HttpGet("me/sessions")]
    public async Task<IActionResult> Sessions(CancellationToken ct)
    {
        var list = await _sessions.GetActiveSessionsAsync(_current.RequireUserId(), ct);
        return Ok(ApiResult.Ok(list));
    }

    [HttpDelete("me/sessions/{sessionId:guid}")]
    public async Task<IActionResult> RevokeSession(Guid sessionId, CancellationToken ct)
    {
        await _sessions.RevokeSessionAsync(sessionId, ct);
        return Ok(ApiResult.Ok(new { revoked = true }));
    }

    [HttpPost("me/sessions/revoke-all")]
    public async Task<IActionResult> RevokeAll(CancellationToken ct)
    {
        await _sessions.RevokeAllSessionsAsync(_current.RequireUserId(), ct);
        return Ok(ApiResult.Ok(new { revoked = true }));
    }

    [HttpGet("me/summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var userId = _current.RequireUserId();

        var profile = await _profile.GetProfileAsync(userId, ct);
        var subscription = await _plans.GetOrCreateAsync(userId, ct);
        var plan = await _plans.GetCurrentPlanAsync(userId, ct);
        var aiCallsUsed = await _usage.GetCurrentMonthUsageAsync(userId, ct);

        var resumes = await _db.Resumes
            .AsNoTracking()
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.UpdatedAt)
            .Select(r => new
            {
                r.Id,
                r.Title,
                r.SourceFileName,
                r.CreatedAt,
                r.UpdatedAt,
                HasParsedData = r.ParsedDataJson != null,
                LatestAnalysis = _db.ResumeAnalyses
                    .Where(a => a.ResumeId == r.Id)
                    .OrderByDescending(a => a.CreatedAt)
                    .Select(a => new { a.Id, a.Score, a.CreatedAt, a.ResultJson })
                    .FirstOrDefault(),
                JobMatchCount = _db.JobMatches.Count(j => j.ResumeId == r.Id),
                CoverLetterCount = _db.CoverLetters.Count(c => c.ResumeId == r.Id),
                JobMatches = _db.JobMatches
                    .Where(j => j.ResumeId == r.Id)
                    .OrderByDescending(j => j.CreatedAt)
                    .Select(j => new { j.Id, j.MatchScore, j.CreatedAt, j.ResultJson })
                    .ToList(),
                LatestCoverLetter = _db.CoverLetters
                    .Where(c => c.ResumeId == r.Id)
                    .OrderByDescending(c => c.CreatedAt)
                    .Select(c => new { c.Id, c.JobTitle, c.Company, c.BodyText, c.CreatedAt })
                    .FirstOrDefault(),
            })
            .ToListAsync(ct);

        var totals = new
        {
            resumes = resumes.Count,
            jobMatches = await _db.JobMatches.CountAsync(x => x.UserId == userId, ct),
            coverLetters = await _db.CoverLetters.CountAsync(x => x.UserId == userId, ct),
            careerCoach = await _db.CareerCoachSessions.CountAsync(x => x.UserId == userId, ct),
            interviewCoach = await _db.InterviewCoachSessions.CountAsync(x => x.UserId == userId, ct),
            salaryEstimates = await _db.SalaryEstimates.CountAsync(x => x.UserId == userId, ct),
        };

        var recentCareer = await _db.CareerCoachSessions
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(1)
            .Select(x => new { x.Id, x.CreatedAt, x.Analysis, x.ResultJson })
            .FirstOrDefaultAsync(ct);

        var recentInterview = await _db.InterviewCoachSessions
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(1)
            .Select(x => new { x.Id, x.CreatedAt, x.Analysis, x.ResultJson })
            .FirstOrDefaultAsync(ct);

        var recentSalary = await _db.SalaryEstimates
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(1)
            .Select(x => new { x.Id, x.CreatedAt, x.Analysis, x.EstimateJson })
            .FirstOrDefaultAsync(ct);

        return Ok(ApiResult.Ok(new
        {
            user = new
            {
                id = userId,
                email = profile?.Email,
                displayName = profile?.DisplayName,
                firstName = profile?.FirstName,
                lastName = profile?.LastName,
                avatarUrl = profile?.AvatarUrl,
            },
            plan = new
            {
                code = plan.Code.ToString(),
                name = plan.Name,
                lookupKey = plan.LookupKey,
                isPaid = plan.IsPaid,
            },
            aiUsage = new
            {
                used = aiCallsUsed,
                limit = plan.Limits.MonthlyAiCalls == int.MaxValue ? (int?)null : plan.Limits.MonthlyAiCalls,
            },
            subscription = new
            {
                status = subscription.Status,
                cancelAtPeriodEnd = subscription.CancelAtPeriodEnd,
                currentPeriodEnd = subscription.CurrentPeriodEnd,
                stripeSubscriptionId = subscription.StripeSubscriptionId,
            },
            totals,
            resumes = resumes.Select(r => new
            {
                r.Id,
                r.Title,
                r.SourceFileName,
                r.CreatedAt,
                r.UpdatedAt,
                r.HasParsedData,
                latestAnalysis = r.LatestAnalysis == null ? null : new
                {
                    r.LatestAnalysis.Id,
                    r.LatestAnalysis.Score,
                    r.LatestAnalysis.CreatedAt,
                    result = Deserialize(r.LatestAnalysis.ResultJson),
                },
                jobMatchCount = r.JobMatchCount,
                coverLetterCount = r.CoverLetterCount,
                jobMatches = r.JobMatches.Select(j => new
                {
                    j.Id,
                    j.MatchScore,
                    j.CreatedAt,
                    result = Deserialize(j.ResultJson),
                }),
                latestCoverLetter = r.LatestCoverLetter == null ? null : new
                {
                    r.LatestCoverLetter.Id,
                    r.LatestCoverLetter.JobTitle,
                    r.LatestCoverLetter.Company,
                    text = r.LatestCoverLetter.BodyText,
                    r.LatestCoverLetter.CreatedAt,
                },
            }),
            recent = new
            {
                career = recentCareer == null ? null : new
                {
                    recentCareer.Id,
                    recentCareer.CreatedAt,
                    recentCareer.Analysis,
                    result = Deserialize(recentCareer.ResultJson),
                },
                interview = recentInterview == null ? null : new
                {
                    recentInterview.Id,
                    recentInterview.CreatedAt,
                    recentInterview.Analysis,
                    result = Deserialize(recentInterview.ResultJson),
                },
                salary = recentSalary == null ? null : new
                {
                    recentSalary.Id,
                    recentSalary.CreatedAt,
                    recentSalary.Analysis,
                    estimate = Deserialize(recentSalary.EstimateJson),
                },
            }
        }));
    }

    private static object? Deserialize(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<JsonElement>(json, JsonOptions); }
        catch { return null; }
    }
}
