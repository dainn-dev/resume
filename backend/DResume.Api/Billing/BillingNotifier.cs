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
    Task SendAdminGrantedAsync(string email, string name, PlanDefinition plan, DateTime? expiresAt, string? note, CancellationToken ct = default);
    Task SendPriceChangeScheduledAsync(string email, string name, PlanDefinition plan, long oldCents, long newCents, DateTime? renewDate, CancellationToken ct = default);
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
        var features = BuildFeatureList(plan);
        var receiptBlock = invoiceUrl is null ? "" : $"""
            <div style="text-align: center; margin: 16px 0;">
              <a href="{invoiceUrl}" style="display: inline-block; border: 1px solid #374151; color: #9ca3af; padding: 8px 18px; border-radius: 8px; text-decoration: none; font-size: 12px;">📄 View receipt</a>
            </div>
            """;

        var html = Wrap("#2563eb", $"Welcome to {plan.Name}", $"""
            <p style="margin: 0 0 16px; font-size: 15px;">Hello {Escape(name)},</p>
            <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5;">Your subscription to <strong style="color:#fff">{plan.Name}</strong> is now active. Thanks for upgrading — here's a summary of your new benefits and the charge details.</p>

            <div style="background: #1f2937; border-radius: 10px; padding: 18px; margin: 0 0 24px;">
              <h3 style="margin: 0 0 12px; font-size: 13px; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.5px;">Billing summary</h3>
              {Row("Plan", $"<strong>{plan.Name}</strong>")}
              {Row("Amount charged", $"<strong>{price}</strong>")}
              {Row("Next billing date", renew)}
              {Row("Status", "<span style=\"color:#34d399\">● Active</span>")}
            </div>

            <div style="background: #1f2937; border-radius: 10px; padding: 18px; margin: 0 0 24px;">
              <h3 style="margin: 0 0 12px; font-size: 13px; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.5px;">What you can do now</h3>
              {features}
            </div>

            {receiptBlock}
            {ManageButton()}

            <p style="margin: 24px 0 0; color: #6b7280; font-size: 11px; line-height: 1.6;">
              Need help? Reply to this email or visit your <a href="{FrontendUrl}/account" style="color: #60a5fa;">account page</a>.<br>
              You can cancel anytime — your access continues until the end of the period.
            </p>
            """);
        return SendSafelyAsync(email, subject, html, ct);
    }

    private static string BuildFeatureList(PlanDefinition plan)
    {
        var items = new List<string>();
        var limits = plan.Limits;
        items.Add($"<strong>{(limits.MaxResumes == int.MaxValue ? "Unlimited" : limits.MaxResumes.ToString())}</strong> resumes stored");
        items.Add($"<strong>{(limits.MonthlyAiCalls == int.MaxValue ? "Unlimited" : limits.MonthlyAiCalls.ToString())}</strong> AI calls per month");
        if (limits.JobMatchEnabled) items.Add("Job Match analysis with ATS scoring");
        if (limits.CoverLetterEnabled) items.Add("AI-generated cover letters");
        if (limits.CareerCoachEnabled) items.Add("AI Career Coach roadmap");
        if (limits.InterviewCoachEnabled) items.Add("Interview prep with mock questions");
        if (limits.SalaryEstimatorEnabled) items.Add("Salary estimator for any role");
        if (limits.CalendarEnabled) items.Add("Goals & Tasks calendar planner");
        if (limits.CompanyReviewEnabled) items.Add("Company reviews — research any employer");
        if (limits.PriorityQueue) items.Add("⚡ Priority AI processing queue");

        var sb = new System.Text.StringBuilder();
        foreach (var it in items)
            sb.Append($"<p style=\"margin: 6px 0; font-size: 13px; color: #d1d5db;\">✓ {it}</p>");
        return sb.ToString();
    }

    private static string Row(string label, string value) =>
        $"<div style=\"display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;\"><span style=\"color: #9ca3af;\">{label}</span><span style=\"color: #e5e7eb;\">{value}</span></div>";

    public Task SendUpgradedAsync(string email, string name, PlanDefinition fromPlan, PlanDefinition toPlan, DateTime? renewDate, CancellationToken ct = default)
    {
        var subject = $"You upgraded to {toPlan.Name}";
        var renew = renewDate?.ToString("MMM d, yyyy") ?? "the next billing period";
        var newFeatures = BuildPlanDiff(fromPlan, toPlan, isUpgrade: true);

        var html = Wrap("#16a34a", $"Upgraded to {toPlan.Name}", $"""
            <p style="margin: 0 0 16px; font-size: 15px;">Hello {Escape(name)},</p>
            <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5;">You moved up from <strong>{fromPlan.Name}</strong> to <strong style="color:#fff">{toPlan.Name}</strong>. Stripe charged the prorated difference to the card on file — you have access to the new tier immediately.</p>

            <div style="background: #1f2937; border-radius: 10px; padding: 18px; margin: 0 0 24px;">
              <h3 style="margin: 0 0 12px; font-size: 13px; color: #6ee7b7; text-transform: uppercase; letter-spacing: 0.5px;">Plan change</h3>
              {Row("Previous", fromPlan.Name)}
              {Row("New", $"<strong>{toPlan.Name}</strong>")}
              {Row("Billing", "Prorated difference charged now")}
              {Row("Next full billing", renew)}
              {Row("Status", "<span style=\"color:#34d399\">● Active</span>")}
            </div>

            {(string.IsNullOrEmpty(newFeatures) ? "" : $"""
            <div style="background: #1f2937; border-radius: 10px; padding: 18px; margin: 0 0 24px;">
              <h3 style="margin: 0 0 12px; font-size: 13px; color: #6ee7b7; text-transform: uppercase; letter-spacing: 0.5px;">What's new for you</h3>
              {newFeatures}
            </div>
            """)}

            {ManageButton()}
            <p style="margin: 24px 0 0; color: #6b7280; font-size: 11px; line-height: 1.6;">
              Need help? Reply to this email or visit your <a href="{FrontendUrl}/account" style="color: #60a5fa;">account page</a>.
            </p>
            """);
        return SendSafelyAsync(email, subject, html, ct);
    }

    public Task SendDowngradedAsync(string email, string name, PlanDefinition fromPlan, PlanDefinition toPlan, DateTime? renewDate, CancellationToken ct = default)
    {
        var subject = $"You downgraded to {toPlan.Name}";
        var renew = renewDate?.ToString("MMM d, yyyy") ?? "the next billing period";
        var lostFeatures = BuildPlanDiff(fromPlan, toPlan, isUpgrade: false);

        var html = Wrap("#f59e0b", $"Downgraded to {toPlan.Name}", $"""
            <p style="margin: 0 0 16px; font-size: 15px;">Hello {Escape(name)},</p>
            <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5;">Your subscription was switched from <strong>{fromPlan.Name}</strong> to <strong style="color:#fff">{toPlan.Name}</strong>. Any unused time on {fromPlan.Name} was credited back as proration — you'll see it on your next invoice.</p>

            <div style="background: #1f2937; border-radius: 10px; padding: 18px; margin: 0 0 24px;">
              <h3 style="margin: 0 0 12px; font-size: 13px; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.5px;">Plan change</h3>
              {Row("Previous", fromPlan.Name)}
              {Row("New", $"<strong>{toPlan.Name}</strong>")}
              {Row("Billing", "Prorated credit applied")}
              {Row("Next billing", renew)}
              {Row("Status", "<span style=\"color:#34d399\">● Active</span>")}
            </div>

            {(string.IsNullOrEmpty(lostFeatures) ? "" : $"""
            <div style="background: #1f2937; border-radius: 10px; padding: 18px; margin: 0 0 24px;">
              <h3 style="margin: 0 0 12px; font-size: 13px; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.5px;">What changed</h3>
              {lostFeatures}
            </div>
            """)}

            {ManageButton("Manage / re-upgrade")}
            <p style="margin: 24px 0 0; color: #6b7280; font-size: 11px; line-height: 1.6;">
              You can return to {fromPlan.Name} anytime from your account page.
            </p>
            """);
        return SendSafelyAsync(email, subject, html, ct);
    }

    public Task SendCancellationScheduledAsync(string email, string name, PlanDefinition plan, DateTime? endDate, CancellationToken ct = default)
    {
        var subject = "Your subscription is scheduled to cancel";
        var end = endDate?.ToString("MMM d, yyyy") ?? "the end of your current period";

        var html = Wrap("#dc2626", "Cancellation scheduled", $"""
            <p style="margin: 0 0 16px; font-size: 15px;">Hello {Escape(name)},</p>
            <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5;">We've scheduled your <strong>{plan.Name}</strong> subscription to end. You'll keep <strong style="color:#fff">full access until {end}</strong> — no further charges after that.</p>

            <div style="background: #1f2937; border-radius: 10px; padding: 18px; margin: 0 0 24px;">
              <h3 style="margin: 0 0 12px; font-size: 13px; color: #fca5a5; text-transform: uppercase; letter-spacing: 0.5px;">Cancellation details</h3>
              {Row("Current plan", plan.Name)}
              {Row("Access until", $"<strong>{end}</strong>")}
              {Row("Auto-renew", "<span style=\"color:#f87171\">Off</span>")}
              {Row("Status", "<span style=\"color:#fbbf24\">● Ends at period end</span>")}
            </div>

            <div style="background: #1f2937; border-radius: 10px; padding: 18px; margin: 0 0 24px;">
              <p style="margin: 0; font-size: 13px; color: #d1d5db; line-height: 1.5;">
                💡 <strong style="color:#fff">Changed your mind?</strong> You can resume your subscription anytime before {end}. Your access never lapses, and there are no extra charges.
              </p>
            </div>

            {ManageButton("Resume subscription")}
            <p style="margin: 24px 0 0; color: #6b7280; font-size: 11px; line-height: 1.6;">
              All resumes, analyses, and history are preserved even after the subscription ends.
            </p>
            """);
        return SendSafelyAsync(email, subject, html, ct);
    }

    public Task SendResumedAsync(string email, string name, PlanDefinition plan, DateTime? renewDate, CancellationToken ct = default)
    {
        var subject = $"Your {plan.Name} subscription was resumed";
        var renew = renewDate?.ToString("MMM d, yyyy") ?? "the next billing period";

        var html = Wrap("#2563eb", "Subscription resumed", $"""
            <p style="margin: 0 0 16px; font-size: 15px;">Hello {Escape(name)},</p>
            <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5;">Glad to have you back! 🎉 Your <strong style="color:#fff">{plan.Name}</strong> subscription will continue to renew automatically — auto-renew is now back on.</p>

            <div style="background: #1f2937; border-radius: 10px; padding: 18px; margin: 0 0 24px;">
              <h3 style="margin: 0 0 12px; font-size: 13px; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.5px;">Subscription</h3>
              {Row("Plan", $"<strong>{plan.Name}</strong>")}
              {Row("Next billing date", renew)}
              {Row("Auto-renew", "<span style=\"color:#34d399\">On</span>")}
              {Row("Status", "<span style=\"color:#34d399\">● Active</span>")}
            </div>

            {ManageButton()}
            <p style="margin: 24px 0 0; color: #6b7280; font-size: 11px; line-height: 1.6;">
              Need help? Reply to this email or visit your <a href="{FrontendUrl}/account" style="color: #60a5fa;">account page</a>.
            </p>
            """);
        return SendSafelyAsync(email, subject, html, ct);
    }

    public Task SendSubscriptionEndedAsync(string email, string name, PlanDefinition previousPlan, CancellationToken ct = default)
    {
        var subject = "Your subscription has ended";
        var lostFeatures = BuildPlanDiff(previousPlan, PlanCatalog.Free, isUpgrade: false);

        var html = Wrap("#6b7280", "Subscription ended", $"""
            <p style="margin: 0 0 16px; font-size: 15px;">Hello {Escape(name)},</p>
            <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5;">Your <strong>{previousPlan.Name}</strong> subscription has ended. You've been moved to the <strong style="color:#fff">Free plan</strong> — all your resumes, analyses, and history remain saved.</p>

            <div style="background: #1f2937; border-radius: 10px; padding: 18px; margin: 0 0 24px;">
              <h3 style="margin: 0 0 12px; font-size: 13px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">Account status</h3>
              {Row("Previous plan", previousPlan.Name)}
              {Row("Current plan", "<strong>Free</strong>")}
              {Row("Ended", DateTime.UtcNow.ToString("MMM d, yyyy"))}
              {Row("Status", "<span style=\"color:#9ca3af\">● Free tier</span>")}
            </div>

            {(string.IsNullOrEmpty(lostFeatures) ? "" : $"""
            <div style="background: #1f2937; border-radius: 10px; padding: 18px; margin: 0 0 24px;">
              <h3 style="margin: 0 0 12px; font-size: 13px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">What's no longer available</h3>
              {lostFeatures}
            </div>
            """)}

            <div style="background: #1f2937; border-radius: 10px; padding: 18px; margin: 0 0 24px;">
              <p style="margin: 0; font-size: 13px; color: #d1d5db; line-height: 1.5;">
                💡 Resubscribe anytime to restore {previousPlan.Name} features. Your data stays where it is.
              </p>
            </div>

            {ManageButton("Resubscribe")}
            """);
        return SendSafelyAsync(email, subject, html, ct);
    }

    public Task SendAdminGrantedAsync(string email, string name, PlanDefinition plan, DateTime? expiresAt, string? note, CancellationToken ct = default)
    {
        var subject = $"You've been granted DResume {plan.Name} 🎁";
        var expiry = expiresAt?.ToString("MMM d, yyyy") ?? "no expiration";
        var noteBlock = string.IsNullOrWhiteSpace(note) ? "" : $"""
            <div style="background: #1f2937; border-radius: 10px; padding: 18px; margin: 0 0 24px;">
              <h3 style="margin: 0 0 8px; font-size: 13px; color: #c4b5fd; text-transform: uppercase; letter-spacing: 0.5px;">Note from the team</h3>
              <p style="margin: 0; font-size: 13px; color: #d1d5db; line-height: 1.5; font-style: italic;">"{Escape(note)}"</p>
            </div>
            """;
        var features = BuildFeatureList(plan);

        var html = Wrap("#7c3aed", $"{plan.Name} Plan Granted", $"""
            <p style="margin: 0 0 16px; font-size: 15px;">Hello {Escape(name)},</p>
            <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5;">Good news — our team has granted you complimentary access to the <strong style="color:#fff">{plan.Name}</strong> plan. No payment needed.</p>

            <div style="background: #1f2937; border-radius: 10px; padding: 18px; margin: 0 0 24px;">
              <h3 style="margin: 0 0 12px; font-size: 13px; color: #c4b5fd; text-transform: uppercase; letter-spacing: 0.5px;">Grant details</h3>
              {Row("Plan", $"<strong>{plan.Name}</strong>")}
              {Row("Cost", "<span style=\"color:#34d399\">Free (complimentary)</span>")}
              {Row("Valid until", expiry)}
              {Row("Status", "<span style=\"color:#34d399\">● Active</span>")}
            </div>

            {noteBlock}

            <div style="background: #1f2937; border-radius: 10px; padding: 18px; margin: 0 0 24px;">
              <h3 style="margin: 0 0 12px; font-size: 13px; color: #c4b5fd; text-transform: uppercase; letter-spacing: 0.5px;">What you can do now</h3>
              {features}
            </div>

            {ManageButton("Start exploring")}
            <p style="margin: 24px 0 0; color: #6b7280; font-size: 11px; line-height: 1.6;">
              This is a complimentary grant from the DResume team — you won't be charged. If you have questions, reply to this email.
            </p>
            """);
        return SendSafelyAsync(email, subject, html, ct);
    }

    public Task SendPriceChangeScheduledAsync(string email, string name, PlanDefinition plan, long oldCents, long newCents, DateTime? renewDate, CancellationToken ct = default)
    {
        var oldPrice = FormatPrice(oldCents, plan.Currency);
        var newPrice = FormatPrice(newCents, plan.Currency);
        var renew = renewDate?.ToString("MMM d, yyyy") ?? "your next billing date";
        var diffCents = newCents - oldCents;
        var diffLabel = diffCents > 0 ? $"+{FormatPrice(Math.Abs(diffCents), plan.Currency)}" : $"-{FormatPrice(Math.Abs(diffCents), plan.Currency)}";
        var headerColor = diffCents > 0 ? "#f59e0b" : "#16a34a";
        var subjectVerb = diffCents > 0 ? "increase" : "decrease";

        var html = Wrap(headerColor, $"Price {subjectVerb} on your {plan.Name} plan", $"""
            <p style="margin: 0 0 16px; font-size: 15px;">Hello {Escape(name)},</p>
            <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5;">A heads-up: your <strong>{plan.Name}</strong> subscription price is changing at your next renewal on <strong style="color:#fff">{renew}</strong>. No change to your current billing period — you'll continue at the existing rate until then.</p>

            <div style="background: #1f2937; border-radius: 10px; padding: 18px; margin: 0 0 24px;">
              <h3 style="margin: 0 0 12px; font-size: 13px; color: #fde68a; text-transform: uppercase; letter-spacing: 0.5px;">Pricing change</h3>
              {Row("Plan", $"<strong>{plan.Name}</strong>")}
              {Row("Current price", oldPrice + "/mo")}
              {Row("New price (from " + renew + ")", $"<strong>{newPrice}/mo</strong> <span style=\"color:#9ca3af\">({diffLabel})</span>")}
              {Row("Status", "<span style=\"color:#34d399\">● Active</span>")}
            </div>

            <div style="background: #1f2937; border-radius: 10px; padding: 18px; margin: 0 0 24px;">
              <p style="margin: 0; font-size: 13px; color: #d1d5db; line-height: 1.5;">
                💡 Nothing to do — your subscription keeps running and the new price kicks in automatically at renewal. If you'd prefer to cancel before then, you can do that from your account page.
              </p>
            </div>

            {ManageButton()}
            <p style="margin: 24px 0 0; color: #6b7280; font-size: 11px; line-height: 1.6;">
              Questions? Reply to this email or visit your <a href="{FrontendUrl}/account" style="color: #60a5fa;">account page</a>.
            </p>
            """);
        return SendSafelyAsync(email, subject: $"Your {plan.Name} subscription price will {subjectVerb}", html, ct);
    }

    private static string BuildPlanDiff(PlanDefinition from, PlanDefinition to, bool isUpgrade)
    {
        var sb = new System.Text.StringBuilder();
        var fl = from.Limits;
        var tl = to.Limits;
        var prefix = isUpgrade ? "✓" : "▸";
        var color = isUpgrade ? "#86efac" : "#fcd34d";

        void Line(string text) =>
            sb.Append($"<p style=\"margin: 6px 0; font-size: 13px; color: #d1d5db;\"><span style=\"color:{color}\">{prefix}</span> {text}</p>");

        if (fl.MaxResumes != tl.MaxResumes)
        {
            var fromN = fl.MaxResumes == int.MaxValue ? "Unlimited" : fl.MaxResumes.ToString();
            var toN = tl.MaxResumes == int.MaxValue ? "Unlimited" : tl.MaxResumes.ToString();
            Line(isUpgrade ? $"Resume storage: {fromN} → <strong>{toN}</strong>" : $"Resume limit reduced: {fromN} → {toN}");
        }
        if (fl.MonthlyAiCalls != tl.MonthlyAiCalls)
        {
            var fromN = fl.MonthlyAiCalls == int.MaxValue ? "Unlimited" : fl.MonthlyAiCalls.ToString();
            var toN = tl.MonthlyAiCalls == int.MaxValue ? "Unlimited" : tl.MonthlyAiCalls.ToString();
            Line(isUpgrade ? $"AI calls / month: {fromN} → <strong>{toN}</strong>" : $"AI calls / month reduced: {fromN} → {toN}");
        }
        if (!fl.JobMatchEnabled && tl.JobMatchEnabled) Line("Job Match analysis now unlocked");
        if (fl.JobMatchEnabled && !tl.JobMatchEnabled) Line("Job Match no longer available");
        if (!fl.CoverLetterEnabled && tl.CoverLetterEnabled) Line("AI Cover Letter generator unlocked");
        if (fl.CoverLetterEnabled && !tl.CoverLetterEnabled) Line("Cover Letter no longer available");
        if (!fl.CareerCoachEnabled && tl.CareerCoachEnabled) Line("AI Career Coach roadmap unlocked");
        if (fl.CareerCoachEnabled && !tl.CareerCoachEnabled) Line("Career Coach no longer available");
        if (!fl.InterviewCoachEnabled && tl.InterviewCoachEnabled) Line("Interview prep unlocked");
        if (fl.InterviewCoachEnabled && !tl.InterviewCoachEnabled) Line("Interview Coach no longer available");
        if (!fl.SalaryEstimatorEnabled && tl.SalaryEstimatorEnabled) Line("Salary Estimator unlocked");
        if (fl.SalaryEstimatorEnabled && !tl.SalaryEstimatorEnabled) Line("Salary Estimator no longer available");
        if (!fl.CalendarEnabled && tl.CalendarEnabled) Line("Goals & Tasks calendar unlocked");
        if (fl.CalendarEnabled && !tl.CalendarEnabled) Line("Goals & Tasks no longer available");
        if (!fl.CompanyReviewEnabled && tl.CompanyReviewEnabled) Line("Company Reviews unlocked");
        if (fl.CompanyReviewEnabled && !tl.CompanyReviewEnabled) Line("Company Reviews no longer available");
        if (!fl.PriorityQueue && tl.PriorityQueue) Line("⚡ Priority AI processing queue");
        if (fl.PriorityQueue && !tl.PriorityQueue) Line("Priority queue no longer available");

        return sb.ToString();
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
