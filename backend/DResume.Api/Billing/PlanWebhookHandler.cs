using DainnStripe.Data;
using DainnStripe.Interfaces;
using Microsoft.EntityFrameworkCore;
using Stripe;
using Stripe.Checkout;

namespace DResume.Api.Billing;

public sealed class PlanWebhookHandler : IStripeWebhookHandler
{
    private readonly IPlanService _plans;
    private readonly DainnStripeDbContext _stripeDb;
    private readonly ILogger<PlanWebhookHandler> _logger;

    private static readonly string[] Handled =
    {
        "checkout.session.completed",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    };

    public PlanWebhookHandler(IPlanService plans, DainnStripeDbContext stripeDb, ILogger<PlanWebhookHandler> logger)
    {
        _plans = plans;
        _stripeDb = stripeDb;
        _logger = logger;
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
        await _plans.SetPlanAsync(
            userId,
            plan,
            session.CustomerId,
            session.SubscriptionId,
            status: "active",
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
            ct);
    }

    private async Task OnSubscriptionChangedAsync(Subscription sub, CancellationToken ct)
    {
        var (userId, plan) = await ResolveAsync(sub, ct);
        if (userId is null) return;

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
    }

    private async Task OnSubscriptionDeletedAsync(Subscription sub, CancellationToken ct)
    {
        var (userId, _) = await ResolveAsync(sub, ct);
        if (userId is null) return;

        await _plans.SetPlanAsync(
            userId.Value,
            PlanCode.Free,
            sub.CustomerId,
            sub.Id,
            status: "canceled",
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
            ct);
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
