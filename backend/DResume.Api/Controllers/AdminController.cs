using DainnUser.Core.Entities;
using DainnUser.Core.Interfaces.Services;
using DainnUser.Infrastructure.Data;
using DResume.Api.Billing;
using DResume.Api.Common;
using DResume.Api.Data;
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
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        size = Math.Clamp(size, 1, 100);

        var query = _userDb.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(u => u.Email.ToLower().Contains(s) || u.Username.ToLower().Contains(s));
        }

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

        object? stripeInvoices = null;
        if (!string.IsNullOrEmpty(sub?.StripeCustomerId))
        {
            try
            {
                var list = await new Stripe.InvoiceService().ListAsync(
                    new Stripe.InvoiceListOptions { Customer = sub.StripeCustomerId, Limit = 10 }, cancellationToken: ct);
                stripeInvoices = list.Data.Select(i => new
                {
                    i.Id, i.Number, i.Status, i.AmountPaid, i.AmountDue, i.Currency, i.Created, i.HostedInvoiceUrl,
                });
            }
            catch { /* best effort */ }
        }

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
            invoices = stripeInvoices,
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

    [HttpDelete("resumes/{resumeId:guid}")]
    public async Task<IActionResult> DeleteResume(Guid resumeId, CancellationToken ct)
    {
        var resume = await _resumeDb.Resumes.FirstOrDefaultAsync(r => r.Id == resumeId, ct)
            ?? throw new KeyNotFoundException("Resume not found.");

        _resumeDb.Resumes.Remove(resume);
        await _resumeDb.SaveChangesAsync(ct);

        return Ok(ApiResult.Ok(new { deleted = true, resumeId }));
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
                    .Select(t => new { id = t.Id, months = t.Months, discountPercent = t.DiscountPercent, active = t.Active })
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
                activeStripePriceId = r?.ActiveStripePriceId,
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

    public sealed record SetPriceRequest(long MonthlyPriceCents);

    [HttpPost("plans/{code}/price")]
    public async Task<IActionResult> ChangePrice(string code, [FromBody] SetPriceRequest req,
        [FromServices] IStripePriceManager priceManager, CancellationToken ct)
    {
        if (!Enum.TryParse<PlanCode>(code, true, out var planCode) || planCode == PlanCode.Free)
            return BadRequest(ApiResult.Fail("Only paid plans (Pro, Premium) can have prices."));
        if (req.MonthlyPriceCents <= 0)
            return BadRequest(ApiResult.Fail("Price must be > 0 cents."));
        var newPrice = await priceManager.CreateNewPriceAsync(planCode, req.MonthlyPriceCents, ct);
        return Ok(ApiResult.Ok(new
        {
            created = true,
            stripePriceId = newPrice.StripePriceId,
            unitAmountCents = newPrice.UnitAmountCents,
            isDefault = newPrice.IsDefault,
        }));
    }

    [HttpGet("plans/{code}/prices")]
    public async Task<IActionResult> ListStripePrices(string code,
        [FromServices] IStripePriceManager priceManager, CancellationToken ct)
    {
        if (!Enum.TryParse<PlanCode>(code, true, out var planCode))
            return BadRequest(ApiResult.Fail("Invalid plan code."));
        var prices = await priceManager.ListPricesAsync(planCode, ct);
        return Ok(ApiResult.Ok(prices));
    }

    [HttpPost("plans/{code}/prices/{stripePriceId}/archive")]
    public async Task<IActionResult> ArchiveStripePrice(string code, string stripePriceId,
        [FromServices] IStripePriceManager priceManager, CancellationToken ct)
    {
        await priceManager.ArchivePriceAsync(stripePriceId, ct);
        return Ok(ApiResult.Ok(new { archived = true, stripePriceId }));
    }

    [HttpPost("plans/{code}/prices/{stripePriceId}/set-default")]
    public async Task<IActionResult> SetDefaultStripePrice(string code, string stripePriceId,
        [FromServices] IStripePriceManager priceManager, CancellationToken ct)
    {
        if (!Enum.TryParse<PlanCode>(code, true, out var planCode))
            return BadRequest(ApiResult.Fail("Invalid plan code."));
        await priceManager.SetDefaultPriceAsync(planCode, stripePriceId, ct);
        return Ok(ApiResult.Ok(new { defaultSet = true, stripePriceId }));
    }

    [HttpGet("plans/{code}/migration-preview")]
    public async Task<IActionResult> MigrationPreview(string code,
        [FromServices] IStripePriceManager priceManager, CancellationToken ct)
    {
        if (!Enum.TryParse<PlanCode>(code, true, out var planCode))
            return BadRequest(ApiResult.Fail("Invalid plan code."));
        var count = await priceManager.CountSubscriptionsOnOldPricesAsync(planCode, ct);
        return Ok(ApiResult.Ok(new { subscribersOnOldPrices = count }));
    }

    [HttpPost("plans/{code}/migrate-to-default")]
    public async Task<IActionResult> MigrateToDefaultPrice(string code,
        [FromServices] IStripePriceManager priceManager, CancellationToken ct)
    {
        if (!Enum.TryParse<PlanCode>(code, true, out var planCode))
            return BadRequest(ApiResult.Fail("Invalid plan code."));
        var result = await priceManager.MigrateSubscriptionsToDefaultAsync(planCode, ct);
        return Ok(ApiResult.Ok(new
        {
            migrated = result.MigratedCount,
            failed = result.FailedCount,
            failedSubscriptionIds = result.FailedSubscriptionIds,
        }));
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
