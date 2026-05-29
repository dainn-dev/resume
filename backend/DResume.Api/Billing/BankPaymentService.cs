using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using DainnUser.Infrastructure.Data;
using DResume.Api.Contracts;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DResume.Api.Billing;

public interface IBankPaymentService
{
    Task<BankPayment> CreatePaymentAsync(Guid userId, PlanCode planCode, int durationMonths, CancellationToken ct = default);
    Task<BankPayment> ConfirmPaymentAsync(BankPayment payment, string? confirmedByEmail, string? webhookRaw, CancellationToken ct = default);
    Task<(BankPayment? payment, string reason)> MatchAndConfirmAsync(BankWebhookRequest webhook, string rawJson, CancellationToken ct = default);
    Task<int> SweepExpiredAsync(Guid? userId = null, CancellationToken ct = default);
    string BuildQrUrl(BankAccount account, long amount, string transactionCode);
    long ComputeAmount(long monthlyVnd, int months);
    int DiscountPercent(int months);
}

public sealed class BankPaymentService : IBankPaymentService
{
    private readonly ResumeDbContext _db;
    private readonly IPlanService _plans;
    private readonly IPlanCatalogService _catalog;
    private readonly IBillingNotifier _notifier;
    private readonly DainnUserDbContext _userDb;
    private readonly ILogger<BankPaymentService> _logger;
    private readonly BillingOptions _options;
    private static readonly Regex TxCodeRegex = new(@"DR[-_ ]?([A-Z0-9]{6,12})", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    // Tolerance for received-vs-expected amount (bank rounding/fees). One rounding unit.
    private const long AmountToleranceVnd = 1000;
    // Sentinel DurationMonths for the test-only 1-day Pro plan.
    private const int TestDurationSentinel = 0;

    public BankPaymentService(
        ResumeDbContext db,
        IPlanService plans,
        IPlanCatalogService catalog,
        IBillingNotifier notifier,
        DainnUserDbContext userDb,
        ILogger<BankPaymentService> logger,
        IOptions<BillingOptions> options)
    {
        _db = db;
        _plans = plans;
        _catalog = catalog;
        _notifier = notifier;
        _userDb = userDb;
        _logger = logger;
        _options = options.Value;
    }

    public int DiscountPercent(int months) => months switch
    {
        12 => 30,
        6 => 20,
        3 => 10,
        _ => 0,
    };

    public long ComputeAmount(long monthlyVnd, int months)
    {
        if (months <= 0) months = 1;
        var gross = monthlyVnd * months;
        var discount = DiscountPercent(months);
        var net = gross * (100 - discount) / 100;
        // Round to nearest 1,000 VND for cleaner UX
        return (long)Math.Round(net / 1000.0) * 1000;
    }

    public async Task<BankPayment> CreatePaymentAsync(Guid userId, PlanCode planCode, int durationMonths, CancellationToken ct = default)
    {
        if (planCode == PlanCode.Free) throw new ArgumentException("Free plan does not require payment.");

        var isTest = durationMonths == TestDurationSentinel;
        if (isTest && !_options.TestPlanEnabled)
            throw new ArgumentException("Test plan is not enabled.");
        if (!isTest && durationMonths is not (1 or 3 or 6 or 12))
            throw new ArgumentException("DurationMonths must be 1, 3, 6, or 12.");

        var plan = await _catalog.GetAsync(planCode, ct);
        if (!isTest && plan.MonthlyPriceVnd <= 0)
            throw new InvalidOperationException($"Plan {planCode} has no VND price configured. Set MonthlyPriceVnd in plans table.");

        var account = await _db.BankAccounts.AsNoTracking()
            .Where(a => a.IsActive)
            .OrderByDescending(a => a.IsDefault)
            .ThenBy(a => a.CreatedAt)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("No active bank account configured. Admin must add one.");

        var amount = isTest ? _options.TestPlanPriceVnd : ComputeAmount(plan.MonthlyPriceVnd, durationMonths);
        var code = GenerateTransactionCode();

        var payment = new BankPayment
        {
            UserId = userId,
            PlanCode = planCode,
            DurationMonths = durationMonths,
            AmountVnd = amount,
            TransactionCode = code,
            BankAccountId = account.Id,
            Status = BankPaymentStatus.Pending,
            ExpiresAt = DateTime.UtcNow.AddHours(24),
        };
        _db.BankPayments.Add(payment);
        await _db.SaveChangesAsync(ct);
        return payment;
    }

    public string BuildQrUrl(BankAccount account, long amount, string transactionCode)
    {
        var holder = Uri.EscapeDataString(account.AccountHolder);
        var info = Uri.EscapeDataString(transactionCode);
        return $"https://img.vietqr.io/image/{account.BankBin}-{account.AccountNumber}-compact2.png?amount={amount}&addInfo={info}&accountName={holder}";
    }

    public async Task<BankPayment> ConfirmPaymentAsync(BankPayment payment, string? confirmedByEmail, string? webhookRaw, CancellationToken ct = default)
    {
        if (payment.Status == BankPaymentStatus.Confirmed) return payment; // fast idempotent path

        var now = DateTime.UtcNow;
        // Atomic compare-and-set: the conditional UPDATE only touches the row while it is
        // not yet confirmed, so exactly one caller (any webhook delivery or admin click) wins.
        // Losers get 0 rows and skip plan activation — no double extension or duplicate email.
        var claimed = await _db.BankPayments
            .Where(p => p.Id == payment.Id && p.Status != BankPaymentStatus.Confirmed)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.Status, BankPaymentStatus.Confirmed)
                .SetProperty(p => p.PaidAt, now)
                .SetProperty(p => p.ConfirmedByEmail, confirmedByEmail)
                .SetProperty(p => p.WebhookRaw, p => webhookRaw ?? p.WebhookRaw)
                .SetProperty(p => p.UpdatedAt, now), ct);

        if (claimed == 0)
        {
            // Lost the race (or row no longer claimable). Refresh and return idempotently.
            await _db.Entry(payment).ReloadAsync(ct);
            return payment;
        }

        // Sync the tracked entity to the persisted state and mark it Unchanged so the
        // upcoming SetPlanAsync.SaveChanges doesn't re-issue a redundant UPDATE on it.
        payment.Status = BankPaymentStatus.Confirmed;
        payment.PaidAt = now;
        payment.ConfirmedByEmail = confirmedByEmail;
        if (!string.IsNullOrEmpty(webhookRaw)) payment.WebhookRaw = webhookRaw;
        payment.UpdatedAt = now;
        _db.Entry(payment).State = EntityState.Unchanged;

        await ApplyPlanAndNotifyAsync(payment, ct);
        return payment;
    }

    // Activates/extends the plan and emails the user. Period stacks onto any remaining
    // time on the same active plan instead of resetting from now.
    private async Task ApplyPlanAndNotifyAsync(BankPayment payment, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var sub = await _plans.GetOrCreateAsync(payment.UserId, ct);
        var baseDate = (sub.PlanCode == payment.PlanCode
                        && sub.Status is "active" or "trialing"
                        && sub.CurrentPeriodEnd.HasValue
                        && sub.CurrentPeriodEnd.Value > now)
            ? sub.CurrentPeriodEnd.Value
            : now;
        var currentPeriodEnd = payment.DurationMonths == TestDurationSentinel
            ? baseDate.AddDays(1)
            : baseDate.AddMonths(payment.DurationMonths);

        await _plans.SetPlanAsync(
            payment.UserId,
            payment.PlanCode,
            stripeCustomerId: null,   // preserved by SetPlanAsync when null
            stripeSubscriptionId: null,
            status: "active",
            cancelAtPeriodEnd: false,
            currentPeriodEnd: currentPeriodEnd,
            ct: ct);

        // Best-effort email
        try
        {
            var plan = await _catalog.GetAsync(payment.PlanCode, ct);
            var user = await _userDb.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == payment.UserId, ct);
            if (user is not null && !string.IsNullOrEmpty(user.Email))
            {
                var displayName = string.IsNullOrWhiteSpace(user.Username) ? user.Email : user.Username;
                await _notifier.SendSubscribedAsync(
                    user.Email!, displayName!, plan,
                    amountPaidCents: payment.AmountVnd, currency: "vnd",
                    renewDate: currentPeriodEnd, invoiceUrl: null, ct);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send subscription email for bank payment {PaymentId}", payment.Id);
        }
    }

    public async Task<int> SweepExpiredAsync(Guid? userId = null, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var query = _db.BankPayments
            .Where(p => p.Status == BankPaymentStatus.Pending && p.ExpiresAt < now);
        if (userId.HasValue) query = query.Where(p => p.UserId == userId.Value);
        return await query.ExecuteUpdateAsync(s => s
            .SetProperty(p => p.Status, BankPaymentStatus.Expired)
            .SetProperty(p => p.UpdatedAt, now), ct);
    }

    public async Task<(BankPayment? payment, string reason)> MatchAndConfirmAsync(BankWebhookRequest webhook, string rawJson, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(webhook.Content)) return (null, "missing_content");
        if (!webhook.Amount.HasValue || webhook.Amount.Value <= 0) return (null, "missing_amount");

        var match = TxCodeRegex.Match(webhook.Content);
        if (!match.Success) return (null, "no_transaction_code");
        var code = $"DR-{match.Groups[1].Value.ToUpperInvariant()}";

        var payment = await _db.BankPayments
            .Include(p => p.BankAccount)
            .FirstOrDefaultAsync(p => p.TransactionCode == code, ct);
        if (payment is null) return (null, "code_not_found");

        if (payment.Status == BankPaymentStatus.Confirmed)
            return (payment, "already_confirmed");

        if (payment.Status is BankPaymentStatus.Cancelled or BankPaymentStatus.Expired)
            return (payment, "payment_not_pending");

        var now = DateTime.UtcNow;
        // Reject (and mark) payments past their window — never auto-confirm a stale transfer.
        if (payment.Status == BankPaymentStatus.Pending && payment.ExpiresAt < now)
        {
            await _db.BankPayments
                .Where(p => p.Id == payment.Id && p.Status == BankPaymentStatus.Pending)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.Status, BankPaymentStatus.Expired)
                    .SetProperty(p => p.UpdatedAt, now), ct);
            return (payment, "expired");
        }

        if (webhook.Amount.Value < payment.AmountVnd - AmountToleranceVnd)
        {
            payment.Status = BankPaymentStatus.Failed;
            payment.Notes = $"Amount mismatch: received {webhook.Amount.Value}, expected {payment.AmountVnd}";
            payment.WebhookRaw = rawJson;
            payment.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            return (payment, "amount_mismatch");
        }

        // ConfirmPaymentAsync does an atomic compare-and-set, so a concurrent worker (another
        // webhook delivery or an admin) can't double-confirm. A previously-Failed payment
        // (e.g. underpaid then topped up) is still rescued here.
        await ConfirmPaymentAsync(payment, confirmedByEmail: null, webhookRaw: rawJson, ct);
        return (payment, "confirmed");
    }

    private static string GenerateTransactionCode()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ambiguous chars removed
        var bytes = RandomNumberGenerator.GetBytes(8);
        var sb = new StringBuilder("DR-", 11);
        foreach (var b in bytes) sb.Append(alphabet[b % alphabet.Length]);
        return sb.ToString();
    }
}
