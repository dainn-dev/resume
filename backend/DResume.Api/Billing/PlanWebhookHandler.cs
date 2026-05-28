using DainnStripe.Data;
using DainnStripe.Interfaces;
using DainnUser.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Stripe;
using Stripe.Checkout;

namespace DResume.Api.Billing;

public sealed class PlanWebhookHandler : IStripeWebhookHandler
{
    private readonly IPlanService _plans;
    private readonly DainnStripeDbContext _stripeDb;
    private readonly DainnUserDbContext _userDb;
    private readonly IBillingNotifier _notifier;
    private readonly ILogger<PlanWebhookHandler> _logger;

    private static readonly string[] Handled =
    {
        "checkout.session.completed",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    };

    public PlanWebhookHandler(
        IPlanService plans,
        DainnStripeDbContext stripeDb,
        DainnUserDbContext userDb,
        IBillingNotifier notifier,
        ILogger<PlanWebhookHandler> logger)
    {
        _plans = plans;
        _stripeDb = stripeDb;
        _userDb = userDb;
        _notifier = notifier;
        _logger = logger;
    }

    private async Task<(string? Email, string Name)> GetUserContactAsync(Guid userId, CancellationToken ct)
    {
        var user = await _userDb.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return (null, "there");
        return (user.Email, string.IsNullOrWhiteSpace(user.Username) ? "there" : user.Username);
    }

    public bool CanHandle(string eventType) => Handled.Contains(eventType);

    public async Task HandleAsync(Event stripeEvent, DainnStripe.Entities.StripeWebhookEventRecord record, CancellationToken ct)
    {
        switch (stripeEvent.Type)
        {
            case "checkout.session.completed":
                await OnCheckoutCompletedAsync((Session)stripeEvent.Data.Object, ct);
                break;
            case "customer.subscription.created":
            case "customer.subscription.updated":
                await OnSubscriptionChangedAsync((Subscription)stripeEvent.Data.Object, ct);
                break;
            case "customer.subscription.deleted":
                await OnSubscriptionDeletedAsync((Subscription)stripeEvent.Data.Object, ct);
                break;
        }
    }

    private async Task OnCheckoutCompletedAsync(Session session, CancellationToken ct)
    {
        var ownerId = ExtractOwnerId(session.Metadata) ?? session.ClientReferenceId;
        if (!Guid.TryParse(ownerId, out var userId))
        {
            _logger.LogWarning("Checkout session {Id} missing parseable owner/user id.", session.Id);
            return;
        }
        if (session.Mode != "subscription" || string.IsNullOrEmpty(session.SubscriptionId)) return;

        var plan = ResolvePlanFromMetadata(session.Metadata) ?? PlanCode.Pro;
        var existing = await _plans.GetOrCreateAsync(userId, ct);
        var previousPlanCode = existing.PlanCode; // snapshot before SetPlanAsync mutates entity

        await _plans.SetPlanAsync(
            userId,
            plan,
            session.CustomerId,
            session.SubscriptionId,
            status: "active",
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
            ct);

        // Notify only on the actual Free → Paid transition
        if (previousPlanCode == PlanCode.Free && plan != PlanCode.Free)
        {
            var (email, name) = await GetUserContactAsync(userId, ct);
            if (!string.IsNullOrWhiteSpace(email))
            {
                // Enrich with subscription period end + invoice URL
                DateTime? periodEnd = null;
                string? invoiceUrl = null;
                try
                {
                    var subSvc = new Stripe.SubscriptionService();
                    var fullSub = await subSvc.GetAsync(session.SubscriptionId, cancellationToken: ct);
                    periodEnd = fullSub.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;
                }
                catch (Exception ex) { _logger.LogDebug(ex, "Failed to fetch subscription detail for email"); }
                try
                {
                    if (!string.IsNullOrEmpty(session.InvoiceId))
                    {
                        var inv = await new Stripe.InvoiceService().GetAsync(session.InvoiceId, cancellationToken: ct);
                        invoiceUrl = inv.HostedInvoiceUrl;
                    }
                }
                catch (Exception ex) { _logger.LogDebug(ex, "Failed to fetch invoice for email"); }

                await _notifier.SendSubscribedAsync(
                    email!, name, PlanCatalog.Get(plan),
                    session.AmountTotal ?? 0,
                    session.Currency ?? "usd",
                    periodEnd,
                    invoiceUrl,
                    ct);
            }
        }
    }

    private async Task OnSubscriptionChangedAsync(Subscription sub, CancellationToken ct)
    {
        var (userId, plan) = await ResolveAsync(sub, ct);
        if (userId is null) return;

        var previous = await _plans.GetOrCreateAsync(userId.Value, ct);
        // Snapshot BEFORE SetPlanAsync mutates the tracked entity in place.
        var prevPlanCode = previous.PlanCode;
        var prevSubId = previous.StripeSubscriptionId;
        var prevCancelAtEnd = previous.CancelAtPeriodEnd;

        var status = sub.Status?.ToLowerInvariant() ?? "active";
        var periodEnd = sub.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;

        await _plans.SetPlanAsync(
            userId.Value,
            plan,
            sub.CustomerId,
            sub.Id,
            status,
            sub.CancelAtPeriodEnd,
            periodEnd,
            ct);

        var (email, name) = await GetUserContactAsync(userId.Value, ct);
        if (string.IsNullOrWhiteSpace(email)) return;

        // Plan change (upgrade/downgrade) on the SAME subscription
        if (prevPlanCode != plan && prevSubId == sub.Id && prevPlanCode != PlanCode.Free)
        {
            var from = PlanCatalog.Get(prevPlanCode);
            var to = PlanCatalog.Get(plan);
            if ((int)plan > (int)prevPlanCode)
                await _notifier.SendUpgradedAsync(email!, name, from, to, periodEnd, ct);
            else
                await _notifier.SendDowngradedAsync(email!, name, from, to, periodEnd, ct);
        }
        // Cancellation scheduled
        else if (!prevCancelAtEnd && sub.CancelAtPeriodEnd)
        {
            await _notifier.SendCancellationScheduledAsync(email!, name, PlanCatalog.Get(plan), periodEnd, ct);
        }
        // Resumed (uncancelled)
        else if (prevCancelAtEnd && !sub.CancelAtPeriodEnd)
        {
            await _notifier.SendResumedAsync(email!, name, PlanCatalog.Get(plan), periodEnd, ct);
        }
    }

    private async Task OnSubscriptionDeletedAsync(Subscription sub, CancellationToken ct)
    {
        var (userId, _) = await ResolveAsync(sub, ct);
        if (userId is null) return;

        var previous = await _plans.GetOrCreateAsync(userId.Value, ct);
        var prevPlanCode = previous.PlanCode; // snapshot

        await _plans.SetPlanAsync(
            userId.Value,
            PlanCode.Free,
            sub.CustomerId,
            sub.Id,
            status: "canceled",
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
            ct);

        if (prevPlanCode != PlanCode.Free)
        {
            var (email, name) = await GetUserContactAsync(userId.Value, ct);
            if (!string.IsNullOrWhiteSpace(email))
                await _notifier.SendSubscriptionEndedAsync(email!, name, PlanCatalog.Get(prevPlanCode), ct);
        }
    }

    private async Task<(Guid? UserId, PlanCode Plan)> ResolveAsync(Subscription sub, CancellationToken ct)
    {
        var ownerId = ExtractOwnerId(sub.Metadata);
        if (Guid.TryParse(ownerId, out var directUserId))
            return (directUserId, ResolvePlanFromMetadata(sub.Metadata) ?? ResolvePlanFromItems(sub));

        var existing = await _plans.FindByStripeSubscriptionAsync(sub.Id, ct);
        if (existing is not null)
            return (existing.UserId, ResolvePlanFromItems(sub));

        _logger.LogWarning("Subscription {Id} has no resolvable owner.", sub.Id);
        return (null, PlanCode.Free);
    }

    private static string? ExtractOwnerId(IDictionary<string, string>? metadata)
    {
        if (metadata is null) return null;
        return metadata.TryGetValue("owner_id", out var owner) ? owner
             : metadata.TryGetValue("user_id", out var user) ? user
             : null;
    }

    private static PlanCode? ResolvePlanFromMetadata(IDictionary<string, string>? metadata)
    {
        if (metadata is null) return null;
        if (metadata.TryGetValue("plan_code", out var raw) && Enum.TryParse<PlanCode>(raw, true, out var parsed))
            return parsed;
        return null;
    }

    private PlanCode ResolvePlanFromItems(Subscription sub)
    {
        var priceId = sub.Items?.Data?.FirstOrDefault()?.Price?.Id;
        if (string.IsNullOrEmpty(priceId)) return PlanCode.Pro;

        var price = _stripeDb.Set<DainnStripe.Entities.DainnStripePrice>()
            .AsNoTracking()
            .FirstOrDefault(p => p.StripePriceId == priceId);
        if (price is null) return PlanCode.Pro;

        var product = _stripeDb.Set<DainnStripe.Entities.DainnStripeProduct>()
            .AsNoTracking()
            .FirstOrDefault(p => p.Id == price.ProductId);
        var plan = PlanCatalog.GetByLookupKey(product?.LookupKey);
        return plan?.Code ?? PlanCode.Pro;
    }
}
