using DainnUser.Core.Interfaces.Services;

namespace DResume.Api.Billing;

public interface IBillingNotifier
{
    Task SendSubscribedAsync(string email, string name, PlanDefinition plan, long amountPaidCents, string currency, DateTime? renewDate, string? invoiceUrl, CancellationToken ct = default);
    Task SendUpgradedAsync(string email, string name, PlanDefinition fromPlan, PlanDefinition toPlan, DateTime? renewDate, CancellationToken ct = default);
    Task SendDowngradedAsync(string email, string name, PlanDefinition fromPlan, PlanDefinition toPlan, DateTime? renewDate, CancellationToken ct = default);
    Task SendCancellationScheduledAsync(string email, string name, PlanDefinition plan, DateTime? endDate, CancellationToken ct = default);
    Task SendResumedAsync(string email, string name, PlanDefinition plan, DateTime? renewDate, CancellationToken ct = default);
    Task SendSubscriptionEndedAsync(string email, string name, PlanDefinition previousPlan, CancellationToken ct = default);
}

public sealed class BillingNotifier : IBillingNotifier
{
    private readonly IEmailService _email;
    private readonly ILogger<BillingNotifier> _logger;
    private const string FrontendUrl = "http://localhost:3000";

    public BillingNotifier(IEmailService email, ILogger<BillingNotifier> logger)
    {
        _email = email;
        _logger = logger;
    }

    public Task SendSubscribedAsync(string email, string name, PlanDefinition plan, long amountPaidCents, string currency, DateTime? renewDate, string? invoiceUrl, CancellationToken ct = default)
    {
        var subject = $"Welcome to DResume {plan.Name} 🎉";
        var price = FormatPrice(amountPaidCents, currency);
        var renew = renewDate?.ToString("MMM d, yyyy") ?? "the end of your billing period";
        var invoiceLine = invoiceUrl is null ? "" : $"<p style=\"margin: 0 0 16px;\"><a href=\"{invoiceUrl}\" style=\"color: #60a5fa;\">View invoice →</a></p>";
        var html = Wrap("#2563eb", $"Welcome to {plan.Name}", $"""
            <p style="margin: 0 0 16px;">Hello {Escape(name)},</p>
            <p style="margin: 0 0 24px;">Your subscription to <strong>{plan.Name}</strong> is now active. Thanks for upgrading!</p>
            {Detail("Plan", plan.Name)}
            {Detail("Amount charged", price)}
            {Detail("Next billing", renew)}
            {invoiceLine}
            {ManageButton()}
            """);
        return SendSafelyAsync(email, subject, html, ct);
    }

    public Task SendUpgradedAsync(string email, string name, PlanDefinition fromPlan, PlanDefinition toPlan, DateTime? renewDate, CancellationToken ct = default)
    {
        var subject = $"You upgraded to {toPlan.Name}";
        var renew = renewDate?.ToString("MMM d, yyyy") ?? "the next billing period";
        var html = Wrap("#16a34a", $"Upgraded to {toPlan.Name}", $"""
            <p style="margin: 0 0 16px;">Hello {Escape(name)},</p>
            <p style="margin: 0 0 24px;">You moved up from <strong>{fromPlan.Name}</strong> to <strong>{toPlan.Name}</strong>. Stripe charged the prorated difference to your card on file.</p>
            {Detail("Previous plan", fromPlan.Name)}
            {Detail("New plan", toPlan.Name)}
            {Detail("Next full billing", renew)}
            {ManageButton()}
            """);
        return SendSafelyAsync(email, subject, html, ct);
    }

    public Task SendDowngradedAsync(string email, string name, PlanDefinition fromPlan, PlanDefinition toPlan, DateTime? renewDate, CancellationToken ct = default)
    {
        var subject = $"You downgraded to {toPlan.Name}";
        var renew = renewDate?.ToString("MMM d, yyyy") ?? "the next billing period";
        var html = Wrap("#f59e0b", $"Downgraded to {toPlan.Name}", $"""
            <p style="margin: 0 0 16px;">Hello {Escape(name)},</p>
            <p style="margin: 0 0 24px;">Your subscription was switched from <strong>{fromPlan.Name}</strong> to <strong>{toPlan.Name}</strong>. Any unused time on {fromPlan.Name} has been credited as proration.</p>
            {Detail("Previous plan", fromPlan.Name)}
            {Detail("New plan", toPlan.Name)}
            {Detail("Next billing", renew)}
            {ManageButton()}
            """);
        return SendSafelyAsync(email, subject, html, ct);
    }

    public Task SendCancellationScheduledAsync(string email, string name, PlanDefinition plan, DateTime? endDate, CancellationToken ct = default)
    {
        var subject = "Your subscription is scheduled to cancel";
        var end = endDate?.ToString("MMM d, yyyy") ?? "the end of your current period";
        var html = Wrap("#dc2626", "Cancellation scheduled", $"""
            <p style="margin: 0 0 16px;">Hello {Escape(name)},</p>
            <p style="margin: 0 0 24px;">We've scheduled your <strong>{plan.Name}</strong> subscription to end on <strong>{end}</strong>. You'll keep full access until that date.</p>
            <p style="margin: 0 0 24px;">Changed your mind? You can resume anytime before the end date.</p>
            {Detail("Plan", plan.Name)}
            {Detail("Access until", end)}
            {ManageButton("Resume subscription")}
            """);
        return SendSafelyAsync(email, subject, html, ct);
    }

    public Task SendResumedAsync(string email, string name, PlanDefinition plan, DateTime? renewDate, CancellationToken ct = default)
    {
        var subject = $"Your {plan.Name} subscription was resumed";
        var renew = renewDate?.ToString("MMM d, yyyy") ?? "the next billing period";
        var html = Wrap("#2563eb", "Subscription resumed", $"""
            <p style="margin: 0 0 16px;">Hello {Escape(name)},</p>
            <p style="margin: 0 0 24px;">Glad to have you back. Your <strong>{plan.Name}</strong> subscription will continue to renew automatically.</p>
            {Detail("Plan", plan.Name)}
            {Detail("Next billing", renew)}
            {ManageButton()}
            """);
        return SendSafelyAsync(email, subject, html, ct);
    }

    public Task SendSubscriptionEndedAsync(string email, string name, PlanDefinition previousPlan, CancellationToken ct = default)
    {
        var subject = "Your subscription has ended";
        var html = Wrap("#6b7280", "Subscription ended", $"""
            <p style="margin: 0 0 16px;">Hello {Escape(name)},</p>
            <p style="margin: 0 0 24px;">Your <strong>{previousPlan.Name}</strong> subscription ended. You've been moved to the Free plan.</p>
            <p style="margin: 0 0 24px;">Anything you created remains accessible. To regain {previousPlan.Name} features, you can resubscribe anytime.</p>
            {ManageButton("Resubscribe")}
            """);
        return SendSafelyAsync(email, subject, html, ct);
    }

    private async Task SendSafelyAsync(string email, string subject, string html, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(email)) return;
        try
        {
            await _email.SendEmailAsync(email, null, subject, html, null, ct);
        }
        catch (Exception ex)
        {
            // Never let an email failure break the billing operation
            _logger.LogWarning(ex, "Failed to send billing notification '{Subject}' to {Email}", subject, email);
        }
    }

    private static string Wrap(string headerColor, string headerText, string body) => $"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #111827; color: #e5e7eb; padding: 0; border-radius: 12px; overflow: hidden;">
          <div style="background: {headerColor}; padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">{headerText}</h1>
          </div>
          <div style="padding: 32px;">
            {body}
            <p style="margin: 32px 0 0; color: #6b7280; font-size: 12px; border-top: 1px solid #1f2937; padding-top: 16px;">
              DResume · AI-powered resume tools · <a href="{FrontendUrl}" style="color: #6b7280;">{FrontendUrl}</a>
            </p>
          </div>
        </div>
        """;

    private static string Detail(string label, string value) =>
        $"<p style=\"margin: 0 0 8px; color: #9ca3af; font-size: 13px;\">{label}: <span style=\"color: #e5e7eb; font-weight: 600;\">{value}</span></p>";

    private static string ManageButton(string text = "Manage subscription") =>
        $"<div style=\"text-align: center; margin: 32px 0 16px;\"><a href=\"{FrontendUrl}/account\" style=\"background: #2563eb; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;\">{text}</a></div>";

    private static string FormatPrice(long cents, string currency)
    {
        var amount = (cents / 100.0).ToString("F2", System.Globalization.CultureInfo.InvariantCulture);
        var symbol = string.Equals(currency, "usd", StringComparison.OrdinalIgnoreCase) ? "$" : currency.ToUpperInvariant() + " ";
        return $"{symbol}{amount}";
    }

    private static string Escape(string s) => System.Net.WebUtility.HtmlEncode(s ?? "");
}
