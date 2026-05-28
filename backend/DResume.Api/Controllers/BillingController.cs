using DainnStripe.Data;
using DainnStripe.Interfaces;
using DResume.Api.Billing;
using DResume.Api.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Stripe.Checkout;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/billing")]
public sealed class BillingController : ControllerBase
{
    private readonly IPlanService _plans;
    private readonly IDainnStripeSubscriptionService _subscriptions;
    private readonly DainnStripeDbContext _stripeDb;
    private readonly BillingOptions _options;
    private readonly ICurrentUser _current;
    private readonly IBillingNotifier _notifier;

    public BillingController(
        IPlanService plans,
        IDainnStripeSubscriptionService subscriptions,
        DainnStripeDbContext stripeDb,
        IOptions<BillingOptions> options,
        ICurrentUser current,
        IBillingNotifier notifier)
    {
        _plans = plans;
        _subscriptions = subscriptions;
        _stripeDb = stripeDb;
        _options = options.Value;
        _current = current;
        _notifier = notifier;
    }

    private string NotifyName => string.IsNullOrWhiteSpace(_current.DisplayName) ? "there" : _current.DisplayName!;

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

        object? paymentMethod = null;
        var invoices = new List<object>();

        if (!string.IsNullOrEmpty(sub.StripeCustomerId))
        {
            try
            {
                // Default payment method: try customer.invoice_settings → subscription.default_payment_method → first listed PM
                Stripe.PaymentMethod? pm = null;
                var customer = await new Stripe.CustomerService().GetAsync(
                    sub.StripeCustomerId,
                    new Stripe.CustomerGetOptions { Expand = new List<string> { "invoice_settings.default_payment_method" } },
                    cancellationToken: ct);
                pm = customer.InvoiceSettings?.DefaultPaymentMethod;

                if (pm is null && !string.IsNullOrEmpty(sub.StripeSubscriptionId))
                {
                    var stripeSub = await new Stripe.SubscriptionService().GetAsync(
                        sub.StripeSubscriptionId,
                        new Stripe.SubscriptionGetOptions { Expand = new List<string> { "default_payment_method" } },
                        cancellationToken: ct);
                    pm = stripeSub.DefaultPaymentMethod;
                }

                if (pm is null)
                {
                    var pms = await new Stripe.PaymentMethodService().ListAsync(
                        new Stripe.PaymentMethodListOptions { Customer = sub.StripeCustomerId, Type = "card", Limit = 1 },
                        cancellationToken: ct);
                    pm = pms.Data.FirstOrDefault();
                }

                if (pm?.Card is not null)
                {
                    paymentMethod = new
                    {
                        brand = pm.Card.Brand,
                        last4 = pm.Card.Last4,
                        expMonth = pm.Card.ExpMonth,
                        expYear = pm.Card.ExpYear,
                    };
                }

                // Top 5 invoices
                var invList = await new Stripe.InvoiceService().ListAsync(
                    new Stripe.InvoiceListOptions { Customer = sub.StripeCustomerId, Limit = 5 },
                    cancellationToken: ct);
                foreach (var inv in invList.Data)
                {
                    invoices.Add(new
                    {
                        id = inv.Id,
                        number = inv.Number,
                        status = inv.Status,
                        amountPaid = inv.AmountPaid,
                        amountDue = inv.AmountDue,
                        currency = inv.Currency,
                        created = inv.Created,
                        hostedInvoiceUrl = inv.HostedInvoiceUrl,
                        description = inv.Description,
                    });
                }
            }
            catch (Stripe.StripeException ex)
            {
                // Don't fail /me if Stripe enrichment fails — UI handles nulls
                Response.Headers["X-Stripe-Warning"] = ex.Message;
            }
        }

        return Ok(ApiResult.Ok(new
        {
            plan = new { code = plan.Code.ToString(), name = plan.Name, lookupKey = plan.LookupKey },
            status = sub.Status,
            cancelAtPeriodEnd = sub.CancelAtPeriodEnd,
            currentPeriodEnd = sub.CurrentPeriodEnd,
            stripeSubscriptionId = sub.StripeSubscriptionId,
            paymentMethod,
            invoices,
        }));
    }

    public sealed record CheckoutRequest(string PlanCode);

    [HttpPost("checkout")]
    [Authorize]
    public async Task<IActionResult> Checkout([FromBody] CheckoutRequest req, CancellationToken ct)
    {
        if (!Enum.TryParse<PlanCode>(req.PlanCode, true, out var planCode) || planCode == PlanCode.Free)
            throw new ArgumentException("Specify a paid plan: Pro or Premium.");

        var plan = PlanCatalog.Get(planCode);
        var userId = _current.RequireUserId();

        var price = await _stripeDb.Set<DainnStripe.Entities.DainnStripePrice>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.LookupKey == $"{plan.LookupKey}_monthly" && p.Active, ct)
            ?? throw new InvalidOperationException($"Stripe price for {plan.Name} has not been seeded yet. Restart the API or call POST /api/billing/seed.");

        var current = await _plans.GetOrCreateAsync(userId, ct);

        // If user already has an active paid subscription, swap items in place
        // instead of creating a duplicate subscription (which would double-charge).
        var hasActivePaidSub = !string.IsNullOrWhiteSpace(current.StripeSubscriptionId)
            && (current.Status == "active" || current.Status == "trialing")
            && current.PlanCode != PlanCode.Free;

        if (hasActivePaidSub)
        {
            if (current.PlanCode == planCode)
                throw new ArgumentException($"You are already on the {plan.Name} plan.");

            // Redirect to Stripe-hosted Customer Portal where the user explicitly confirms
            // the plan change, sees the prorated amount, and can swap payment methods.
            // Stripe handles the subscription update + prorated charge after the user clicks Confirm.
            var portalService = new Stripe.BillingPortal.SessionService();
            var portalSession = await portalService.CreateAsync(new Stripe.BillingPortal.SessionCreateOptions
            {
                Customer = current.StripeCustomerId,
                ReturnUrl = _options.SuccessUrl.Replace("&session_id={CHECKOUT_SESSION_ID}", ""),
                FlowData = new Stripe.BillingPortal.SessionFlowDataOptions
                {
                    Type = "subscription_update_confirm",
                    SubscriptionUpdateConfirm = new Stripe.BillingPortal.SessionFlowDataSubscriptionUpdateConfirmOptions
                    {
                        Subscription = current.StripeSubscriptionId,
                        Items = new List<Stripe.BillingPortal.SessionFlowDataSubscriptionUpdateConfirmItemOptions>
                        {
                            new()
                            {
                                Id = (await new Stripe.SubscriptionService().GetAsync(current.StripeSubscriptionId!, cancellationToken: ct))
                                    .Items?.Data?.FirstOrDefault()?.Id,
                                Price = price.StripePriceId,
                                Quantity = 1,
                            },
                        },
                    },
                },
            }, cancellationToken: ct);

            return Ok(ApiResult.Ok(new { sessionId = (string?)null, url = portalSession.Url }));
        }

        // No active paid subscription → create new Stripe Checkout session.
        // Bypass DainnStripe.CheckoutService — it incorrectly requires a subscription_id
        // immediately after creating a subscription-mode session, but Stripe only creates
        // the subscription AFTER the user completes payment. Call Stripe.net directly.
        var sessionOptions = new SessionCreateOptions
        {
            Mode = "subscription",
            LineItems = new List<SessionLineItemOptions>
            {
                new() { Price = price.StripePriceId, Quantity = 1 },
            },
            SuccessUrl = _options.SuccessUrl,
            CancelUrl = _options.CancelUrl,
            Metadata = new Dictionary<string, string>
            {
                ["owner_id"] = userId.ToString(),
                ["plan_code"] = plan.Code.ToString(),
            },
        };
        if (!string.IsNullOrWhiteSpace(current.StripeCustomerId))
        {
            sessionOptions.Customer = current.StripeCustomerId;
        }
        else if (!string.IsNullOrWhiteSpace(_current.Email))
        {
            // First-time customer — pre-fill email so user doesn't retype it on the Stripe page.
            // Stripe accepts customer_email OR customer, not both.
            sessionOptions.CustomerEmail = _current.Email;
        }

        var sessionService = new SessionService();
        var session = await sessionService.CreateAsync(sessionOptions, cancellationToken: ct);
        return Ok(ApiResult.Ok(new { sessionId = session.Id, url = session.Url }));
    }

    public sealed record SyncSessionRequest(string SessionId);

    [HttpPost("sync-session")]
    [Authorize]
    public async Task<IActionResult> SyncSession([FromBody] SyncSessionRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.SessionId))
            return BadRequest(ApiResult.Fail("session_id is required."));

        var userId = _current.RequireUserId();
        var sessionService = new SessionService();
        var session = await sessionService.GetAsync(req.SessionId, cancellationToken: ct)
            ?? throw new InvalidOperationException("Stripe session not found.");

        if (session.Metadata is not null
            && session.Metadata.TryGetValue("owner_id", out var ownerId)
            && ownerId != userId.ToString())
            return Forbid();

        if (session.PaymentStatus != "paid" && session.PaymentStatus != "no_payment_required")
            return Ok(ApiResult.Ok(new { synced = false, paymentStatus = session.PaymentStatus }));

        if (session.Metadata is null
            || !session.Metadata.TryGetValue("plan_code", out var planCodeStr)
            || !Enum.TryParse<PlanCode>(planCodeStr, true, out var planCode))
            throw new ArgumentException("Plan code missing or invalid in session metadata.");

        var subscriptionId = session.SubscriptionId;
        var status = "active";
        var cancelAtEnd = false;
        DateTime? currentPeriodEnd = null;

        if (!string.IsNullOrEmpty(subscriptionId))
        {
            var subSvc = new Stripe.SubscriptionService();
            var stripeSub = await subSvc.GetAsync(subscriptionId, cancellationToken: ct);
            status = stripeSub.Status;
            cancelAtEnd = stripeSub.CancelAtPeriodEnd;
            currentPeriodEnd = stripeSub.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;
        }

        var previousPlanCode = (await _plans.GetOrCreateAsync(userId, ct)).PlanCode;
        await _plans.SetPlanAsync(userId, planCode, session.CustomerId, subscriptionId, status, cancelAtEnd, currentPeriodEnd, ct);
        var newPlan = await _plans.GetCurrentPlanAsync(userId, ct);

        if (previousPlanCode == PlanCode.Free && planCode != PlanCode.Free && !string.IsNullOrWhiteSpace(_current.Email))
        {
            string? invoiceUrl = null;
            try
            {
                if (!string.IsNullOrEmpty(session.InvoiceId))
                {
                    var inv = await new Stripe.InvoiceService().GetAsync(session.InvoiceId, cancellationToken: ct);
                    invoiceUrl = inv.HostedInvoiceUrl;
                }
            }
            catch { /* best effort */ }

            await _notifier.SendSubscribedAsync(
                _current.Email!, NotifyName, newPlan,
                session.AmountTotal ?? 0,
                session.Currency ?? "usd",
                currentPeriodEnd,
                invoiceUrl,
                ct);
        }

        return Ok(ApiResult.Ok(new
        {
            synced = true,
            plan = new { code = newPlan.Code.ToString(), name = newPlan.Name },
            currentPeriodEnd,
            cancelAtPeriodEnd = cancelAtEnd,
        }));
    }

    [HttpPost("resume")]
    [Authorize]
    public async Task<IActionResult> Resume(CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var sub = await _plans.GetOrCreateAsync(userId, ct);
        if (string.IsNullOrEmpty(sub.StripeSubscriptionId))
            throw new InvalidOperationException("No subscription to resume.");

        var subService = new Stripe.SubscriptionService();
        var existing = await subService.GetAsync(sub.StripeSubscriptionId, cancellationToken: ct);

        if (existing.Status == "canceled")
            throw new InvalidOperationException("Subscription has already ended and cannot be resumed. Please subscribe again.");

        if (!existing.CancelAtPeriodEnd)
            return Ok(ApiResult.Ok(new { resumed = false, alreadyActive = true }));

        var updated = await subService.UpdateAsync(
            sub.StripeSubscriptionId,
            new Stripe.SubscriptionUpdateOptions { CancelAtPeriodEnd = false },
            cancellationToken: ct);

        var periodEnd = updated.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;
        await _plans.SetPlanAsync(
            userId, sub.PlanCode, sub.StripeCustomerId, updated.Id,
            updated.Status ?? "active", cancelAtPeriodEnd: false, currentPeriodEnd: periodEnd, ct);

        if (!string.IsNullOrWhiteSpace(_current.Email))
            await _notifier.SendResumedAsync(_current.Email!, NotifyName, PlanCatalog.Get(sub.PlanCode), periodEnd, ct);

        return Ok(ApiResult.Ok(new { resumed = true, currentPeriodEnd = periodEnd }));
    }

    [HttpPost("sync-current")]
    [Authorize]
    public async Task<IActionResult> SyncCurrent(CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var current = await _plans.GetOrCreateAsync(userId, ct);
        if (string.IsNullOrEmpty(current.StripeCustomerId))
            return Ok(ApiResult.Ok(new { synced = false, reason = "no_customer" }));

        var subService = new Stripe.SubscriptionService();
        var subs = await subService.ListAsync(new Stripe.SubscriptionListOptions
        {
            Customer = current.StripeCustomerId,
            Limit = 10,
        }, cancellationToken: ct);

        var active = subs.Data
            .Where(s => s.Status == "active" || s.Status == "trialing")
            .OrderByDescending(s => s.Created)
            .FirstOrDefault();

        var previousPlanCode = current.PlanCode;
        var previousSubId = current.StripeSubscriptionId;
        var previousCancelAtEnd = current.CancelAtPeriodEnd;

        if (active is null)
        {
            await _plans.SetPlanAsync(userId, PlanCode.Free, current.StripeCustomerId, null, "canceled", false, null, ct);
            if (previousPlanCode != PlanCode.Free && !string.IsNullOrWhiteSpace(_current.Email))
                await _notifier.SendSubscriptionEndedAsync(_current.Email!, NotifyName, PlanCatalog.Get(previousPlanCode), ct);
            return Ok(ApiResult.Ok(new { synced = true, plan = new { code = "Free" } }));
        }

        var priceId = active.Items?.Data?.FirstOrDefault()?.Price?.Id;
        var price = await _stripeDb.Set<DainnStripe.Entities.DainnStripePrice>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.StripePriceId == priceId, ct);
        var product = price is null ? null : await _stripeDb.Set<DainnStripe.Entities.DainnStripeProduct>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == price.ProductId, ct);
        var planCode = PlanCatalog.GetByLookupKey(product?.LookupKey)?.Code ?? PlanCode.Pro;

        var periodEnd = active.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;
        await _plans.SetPlanAsync(
            userId, planCode, current.StripeCustomerId, active.Id,
            active.Status, active.CancelAtPeriodEnd, periodEnd, ct);

        // Notify on transitions — only when plan changes to a different paid tier on the SAME subscription
        // (avoids spamming when sub_id differs because of a fresh checkout, which sync-session already handled).
        if (!string.IsNullOrWhiteSpace(_current.Email) && previousSubId == active.Id && previousPlanCode != planCode)
        {
            var fromPlan = PlanCatalog.Get(previousPlanCode);
            var toPlan = PlanCatalog.Get(planCode);
            if ((int)planCode > (int)previousPlanCode)
                await _notifier.SendUpgradedAsync(_current.Email!, NotifyName, fromPlan, toPlan, periodEnd, ct);
            else if (previousPlanCode != PlanCode.Free)
                await _notifier.SendDowngradedAsync(_current.Email!, NotifyName, fromPlan, toPlan, periodEnd, ct);
        }

        return Ok(ApiResult.Ok(new
        {
            synced = true,
            plan = new { code = planCode.ToString() },
            subscriptionId = active.Id,
            currentPeriodEnd = periodEnd,
        }));
    }

    [HttpPost("cancel")]
    [Authorize]
    public async Task<IActionResult> Cancel(CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var sub = await _plans.GetOrCreateAsync(userId, ct);
        if (string.IsNullOrEmpty(sub.StripeSubscriptionId))
            throw new InvalidOperationException("No active paid subscription to cancel.");

        // Bypass DainnStripe.CancelAsync (requires a record in its own DB that webhooks populate).
        // Use Stripe.net directly + idempotent: handle already-canceled / already-scheduled states.
        var subService = new Stripe.SubscriptionService();

        Stripe.Subscription existing;
        try
        {
            existing = await subService.GetAsync(sub.StripeSubscriptionId, cancellationToken: ct);
        }
        catch (Stripe.StripeException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
        {
            await _plans.SetPlanAsync(userId, PlanCode.Free, sub.StripeCustomerId, null, "canceled", false, null, ct);
            return Ok(ApiResult.Ok(new { canceled = true, alreadyEnded = true }));
        }

        if (existing.Status == "canceled")
        {
            await _plans.SetPlanAsync(userId, PlanCode.Free, sub.StripeCustomerId, existing.Id, "canceled", false, null, ct);
            return Ok(ApiResult.Ok(new { canceled = true, alreadyEnded = true }));
        }

        if (existing.CancelAtPeriodEnd)
        {
            var pe = existing.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;
            await _plans.SetPlanAsync(userId, sub.PlanCode, sub.StripeCustomerId, existing.Id,
                existing.Status ?? "active", cancelAtPeriodEnd: true, currentPeriodEnd: pe, ct);
            return Ok(ApiResult.Ok(new { canceled = true, cancelAtPeriodEnd = true, currentPeriodEnd = pe }));
        }

        var updated = await subService.UpdateAsync(
            sub.StripeSubscriptionId,
            new Stripe.SubscriptionUpdateOptions { CancelAtPeriodEnd = true },
            cancellationToken: ct);

        var periodEnd = updated.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;
        await _plans.SetPlanAsync(
            userId,
            sub.PlanCode,
            sub.StripeCustomerId,
            updated.Id,
            updated.Status ?? "active",
            cancelAtPeriodEnd: true,
            currentPeriodEnd: periodEnd,
            ct);

        // Notify: cancellation scheduled (true transition from active → cancel-scheduled)
        if (!string.IsNullOrWhiteSpace(_current.Email))
            await _notifier.SendCancellationScheduledAsync(_current.Email!, NotifyName, PlanCatalog.Get(sub.PlanCode), periodEnd, ct);

        return Ok(ApiResult.Ok(new
        {
            canceled = true,
            cancelAtPeriodEnd = true,
            currentPeriodEnd = periodEnd,
        }));
    }

    [HttpPost("seed")]
    [Authorize]
    public async Task<IActionResult> SeedCatalog([FromServices] IStripeCatalogSeeder seeder, CancellationToken ct)
    {
        await seeder.SeedAsync(ct);
        return Ok(ApiResult.Ok(new { seeded = true, plans = PlanCatalog.All.Select(p => p.LookupKey) }));
    }
}
