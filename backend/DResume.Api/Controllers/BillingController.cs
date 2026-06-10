using DResume.Api.Billing;
using DResume.Api.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/billing")]
public sealed class BillingController : ControllerBase
{
    private readonly IPlanService _plans;
    private readonly ICurrentUser _current;

    public BillingController(IPlanService plans, ICurrentUser current)
    {
        _plans = plans;
        _current = current;
    }

    [HttpGet("plans")]
    [AllowAnonymous]
    public async Task<IActionResult> ListPlans([FromServices] IPlanCatalogService catalog,
        [FromServices] IBankPricingService pricing, CancellationToken ct)
    {
        var plans = await catalog.GetAllAsync(ct);
        var view = new List<object>();
        foreach (var p in plans)
        {
            var tiers = p.IsPaid
                ? (await pricing.GetActiveTiersAsync(p.Code, ct))
                    .Select(t => new { months = t.Months, discountPercent = t.DiscountPercent, startDate = t.StartDate, endDate = t.EndDate, maxRedemptions = t.MaxRedemptions, redemptions = t.Redemptions })
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
                isPaid = p.IsPaid,
                bankTiers = tiers,
                limits = new
                {
                    maxResumes = p.Limits.MaxResumes == int.MaxValue ? (int?)null : p.Limits.MaxResumes,
                    monthlyAiCalls = p.Limits.MonthlyAiCalls == int.MaxValue ? (int?)null : p.Limits.MonthlyAiCalls,
                    p.Limits.JobMatchEnabled,
                    p.Limits.CoverLetterEnabled,
                    p.Limits.CareerCoachEnabled,
                    p.Limits.InterviewCoachEnabled,
                    p.Limits.SalaryEstimatorEnabled,
                    p.Limits.CalendarEnabled,
                    p.Limits.CompanyReviewEnabled,
                    p.Limits.PriorityQueue,
                }
            });
        }
        return Ok(ApiResult.Ok(view));
    }

    [HttpGet("config")]
    [AllowAnonymous]
    public IActionResult Config([FromServices] IOptions<BillingOptions> options)
    {
        var o = options.Value;
        // Card payments were removed — the platform now bills exclusively via VN bank QR transfer.
        return Ok(ApiResult.Ok(new
        {
            cardPaymentsEnabled = false,
            bankQrEnabled = o.BankQrEnabled,
            testPlanEnabled = o.TestPlanEnabled,
            testPlanPriceVnd = o.TestPlanPriceVnd,
        }));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var sub = await _plans.GetOrCreateAsync(userId, ct);
        var plan = await _plans.GetCurrentPlanAsync(userId, ct);

        return Ok(ApiResult.Ok(new
        {
            plan = new { code = plan.Code.ToString(), name = plan.Name, lookupKey = plan.LookupKey },
            status = sub.Status,
            cancelAtPeriodEnd = sub.CancelAtPeriodEnd,
            currentPeriodEnd = sub.CurrentPeriodEnd,
            // Retained for backward-compatible response shape; bank-QR plans never set this.
            stripeSubscriptionId = sub.StripeSubscriptionId,
            paymentMethod = (object?)null,
            invoices = Array.Empty<object>(),
        }));
    }

    // Legacy card checkout was removed. Upgrades now go through POST /api/billing/bank/checkout
    // (VietQR transfer). Kept as an explicit guard so any stale client gets a clear message
    // instead of a confusing 404.
    [HttpPost("checkout")]
    [Authorize]
    public IActionResult Checkout()
        => BadRequest(ApiResult.Fail("Card checkout has been removed. Use POST /api/billing/bank/checkout to pay by bank transfer."));

    // Stripe subscription sync is gone; bank-QR plans carry no external subscription to sync.
    // Kept so the account page's post-load call resolves cleanly.
    [HttpPost("sync-current")]
    [Authorize]
    public IActionResult SyncCurrent()
        => Ok(ApiResult.Ok(new { synced = false, reason = "card_payments_removed" }));
}
