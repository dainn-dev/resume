using DainnStripe.Data;
using DainnStripe.Enums;
using DainnStripe.Interfaces;
using DainnStripe.Models;
using DResume.Api.Billing;
using DResume.Api.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/billing")]
public sealed class BillingController : ControllerBase
{
    private readonly IPlanService _plans;
    private readonly IDainnStripeCheckoutService _checkout;
    private readonly IDainnStripeSubscriptionService _subscriptions;
    private readonly DainnStripeDbContext _stripeDb;
    private readonly BillingOptions _options;
    private readonly ICurrentUser _current;

    public BillingController(
        IPlanService plans,
        IDainnStripeCheckoutService checkout,
        IDainnStripeSubscriptionService subscriptions,
        DainnStripeDbContext stripeDb,
        IOptions<BillingOptions> options,
        ICurrentUser current)
    {
        _plans = plans;
        _checkout = checkout;
        _subscriptions = subscriptions;
        _stripeDb = stripeDb;
        _options = options.Value;
        _current = current;
    }

    [HttpGet("plans")]
    [AllowAnonymous]
    public IActionResult ListPlans()
    {
        var view = PlanCatalog.All.Select(p => new
        {
            code = p.Code.ToString(),
            lookupKey = p.LookupKey,
            name = p.Name,
            description = p.Description,
            monthlyPriceCents = p.MonthlyPriceCents,
            currency = p.Currency,
            isPaid = p.IsPaid,
            limits = new
            {
                maxResumes = p.Limits.MaxResumes == int.MaxValue ? (int?)null : p.Limits.MaxResumes,
                monthlyAiCalls = p.Limits.MonthlyAiCalls == int.MaxValue ? (int?)null : p.Limits.MonthlyAiCalls,
                p.Limits.JobMatchEnabled,
                p.Limits.CoverLetterEnabled,
                p.Limits.CareerCoachEnabled,
                p.Limits.InterviewCoachEnabled,
                p.Limits.SalaryEstimatorEnabled,
                p.Limits.PriorityQueue,
            }
        });
        return Ok(ApiResult.Ok(view));
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
            stripeSubscriptionId = sub.StripeSubscriptionId,
        }));
    }

    public sealed record CheckoutRequest(string PlanCode);

    [HttpPost("checkout")]
    [Authorize]
    public async Task<IActionResult> Checkout([FromBody] CheckoutRequest req, CancellationToken ct)
    {
        if (!Enum.TryParse<PlanCode>(req.PlanCode, true, out var planCode) || planCode == PlanCode.Free)
            throw new ArgumentException("Specify a paid plan: Pro or Enterprise.");

        var plan = PlanCatalog.Get(planCode);
        var userId = _current.RequireUserId();

        var price = await _stripeDb.Set<DainnStripe.Entities.DainnStripePrice>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.LookupKey == $"{plan.LookupKey}_monthly" && p.Active, ct)
            ?? throw new InvalidOperationException($"Stripe price for {plan.Name} has not been seeded yet. Restart the API or call POST /api/billing/seed.");

        var current = await _plans.GetOrCreateAsync(userId, ct);

        var request = new CreateCheckoutSessionRequest
        {
            OwnerId = userId.ToString(),
            Mode = DainnStripeCheckoutMode.Subscription,
            SuccessUrl = _options.SuccessUrl,
            CancelUrl = _options.CancelUrl,
            StripeCustomerId = current.StripeCustomerId ?? string.Empty,
        };
        request.LineItems.Add(new CreateCheckoutSessionLineItem { StripePriceId = price.StripePriceId!, Quantity = 1 });
        request.Metadata["owner_id"] = userId.ToString();
        request.Metadata["plan_code"] = plan.Code.ToString();

        var result = await _checkout.CreateAsync(request, ct);
        return Ok(ApiResult.Ok(new { sessionId = result.SessionId, url = result.Url }));
    }

    [HttpPost("cancel")]
    [Authorize]
    public async Task<IActionResult> Cancel(CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var sub = await _plans.GetOrCreateAsync(userId, ct);
        if (string.IsNullOrEmpty(sub.StripeSubscriptionId))
            throw new InvalidOperationException("No active paid subscription to cancel.");

        await _subscriptions.CancelAsync(userId.ToString(), sub.StripeSubscriptionId, ct);
        return Ok(ApiResult.Ok(new { canceled = true }));
    }

    [HttpPost("seed")]
    [Authorize]
    public async Task<IActionResult> SeedCatalog([FromServices] IStripeCatalogSeeder seeder, CancellationToken ct)
    {
        await seeder.SeedAsync(ct);
        return Ok(ApiResult.Ok(new { seeded = true, plans = PlanCatalog.All.Select(p => p.LookupKey) }));
    }
}
