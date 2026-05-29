using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DResume.Api.Billing;
using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/billing/bank")]
public sealed class BankPaymentController : ControllerBase
{
    private readonly IBankPaymentService _bank;
    private readonly ResumeDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IConfiguration _config;
    private readonly ILogger<BankPaymentController> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public BankPaymentController(
        IBankPaymentService bank,
        ResumeDbContext db,
        ICurrentUser current,
        IConfiguration config,
        ILogger<BankPaymentController> logger)
    {
        _bank = bank;
        _db = db;
        _current = current;
        _config = config;
        _logger = logger;
    }

    [HttpPost("checkout")]
    [Authorize]
    public async Task<IActionResult> Checkout([FromBody] BankCheckoutRequest req, CancellationToken ct)
    {
        if (!_config.GetValue("Billing:BankQrEnabled", true))
            return BadRequest(ApiResult.Fail("Bank QR payments are currently disabled."));

        var userId = _current.RequireUserId();
        if (!Enum.TryParse<PlanCode>(req.PlanCode, ignoreCase: true, out var plan))
            return BadRequest(ApiResult.Fail("Invalid planCode."));

        // Block bank payment while a card subscription is live — Stripe would keep billing in parallel.
        var existing = await _db.UserSubscriptions.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (existing is not null
            && !string.IsNullOrEmpty(existing.StripeSubscriptionId)
            && existing.Status is "active" or "trialing"
            && !existing.CancelAtPeriodEnd)
        {
            return BadRequest(ApiResult.Fail("You have an active card subscription. Please cancel it before paying by bank transfer."));
        }

        var payment = await _bank.CreatePaymentAsync(userId, plan, req.DurationMonths, ct);
        var account = await _db.BankAccounts.AsNoTracking().FirstAsync(a => a.Id == payment.BankAccountId, ct);

        return Ok(ApiResult.Ok(new BankCheckoutResponse(
            payment.Id,
            payment.TransactionCode,
            payment.AmountVnd,
            new BankAccountSummaryDto(account.BankCode, account.BankName, account.BankBin, account.AccountNumber, account.AccountHolder),
            _bank.BuildQrUrl(account, payment.AmountVnd, payment.TransactionCode),
            payment.ExpiresAt,
            payment.Status.ToString())));
    }

    [HttpGet("payments/{id:guid}")]
    [Authorize]
    public async Task<IActionResult> GetPayment(Guid id, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        await _bank.SweepExpiredAsync(userId, ct);
        var payment = await _db.BankPayments.AsNoTracking()
            .Include(p => p.BankAccount)
            .FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId, ct);
        if (payment is null) return NotFound(ApiResult.Fail("Payment not found."));

        var account = payment.BankAccount!;
        return Ok(ApiResult.Ok(new BankPaymentDetailDto(
            payment.Id,
            payment.PlanCode.ToString(),
            payment.DurationMonths,
            payment.AmountVnd,
            payment.TransactionCode,
            new BankAccountSummaryDto(account.BankCode, account.BankName, account.BankBin, account.AccountNumber, account.AccountHolder),
            _bank.BuildQrUrl(account, payment.AmountVnd, payment.TransactionCode),
            payment.Status.ToString(),
            payment.PaidAt,
            payment.ExpiresAt,
            payment.CreatedAt)));
    }

    [HttpGet("payments/my")]
    [Authorize]
    public async Task<IActionResult> ListMyPayments(CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        await _bank.SweepExpiredAsync(userId, ct);
        var rows = await _db.BankPayments.AsNoTracking()
            .Include(p => p.BankAccount)
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .Take(20)
            .ToListAsync(ct);

        var items = rows.Select(p =>
        {
            var a = p.BankAccount!;
            return new BankPaymentDetailDto(
                p.Id, p.PlanCode.ToString(), p.DurationMonths, p.AmountVnd, p.TransactionCode,
                new BankAccountSummaryDto(a.BankCode, a.BankName, a.BankBin, a.AccountNumber, a.AccountHolder),
                _bank.BuildQrUrl(a, p.AmountVnd, p.TransactionCode),
                p.Status.ToString(), p.PaidAt, p.ExpiresAt, p.CreatedAt);
        });
        return Ok(ApiResult.Ok(items));
    }

    [HttpPost("payments/{id:guid}/cancel")]
    [Authorize]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var payment = await _db.BankPayments.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId, ct);
        if (payment is null) return NotFound(ApiResult.Fail("Payment not found."));
        if (payment.Status != BankPaymentStatus.Pending)
            return BadRequest(ApiResult.Fail("Only pending payments can be cancelled."));

        payment.Status = BankPaymentStatus.Cancelled;
        payment.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new { cancelled = true }));
    }

    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook([FromBody] BankWebhookRequest req, CancellationToken ct)
    {
        var expectedSecret = _config["Billing:BankWebhookSecret"];
        if (string.IsNullOrEmpty(expectedSecret))
        {
            _logger.LogError("Bank webhook called but Billing:BankWebhookSecret is not configured.");
            return StatusCode(500, ApiResult.Fail("Webhook not configured."));
        }
        var providedSecret = Request.Headers["X-Webhook-Secret"].ToString();
        var providedBytes = Encoding.UTF8.GetBytes(providedSecret);
        var expectedBytes = Encoding.UTF8.GetBytes(expectedSecret);
        if (!CryptographicOperations.FixedTimeEquals(providedBytes, expectedBytes))
            return Unauthorized(ApiResult.Fail("Invalid webhook secret."));

        var rawJson = JsonSerializer.Serialize(req, JsonOptions);
        var (payment, reason) = await _bank.MatchAndConfirmAsync(req, rawJson, ct);

        _logger.LogInformation("Bank webhook processed: reason={Reason}, paymentId={PaymentId}", reason, payment?.Id);
        return Ok(ApiResult.Ok(new
        {
            matched = payment is not null,
            reason,
            paymentId = payment?.Id,
            status = payment?.Status.ToString(),
        }));
    }

    // SePay (https://sepay.vn) posts here on each bank transaction. It authenticates with
    // "Authorization: Apikey <key>" and uses its own field names, so we adapt to the generic
    // BankWebhookRequest and reuse the same match-and-confirm logic.
    [HttpPost("webhook/sepay")]
    [AllowAnonymous]
    public async Task<IActionResult> SePayWebhook([FromBody] SePayWebhookRequest req, CancellationToken ct)
    {
        var expectedKey = _config["Billing:SePayApiKey"];
        if (string.IsNullOrEmpty(expectedKey)) expectedKey = _config["Billing:BankWebhookSecret"];
        if (string.IsNullOrEmpty(expectedKey))
        {
            _logger.LogError("SePay webhook called but neither Billing:SePayApiKey nor BankWebhookSecret is configured.");
            return StatusCode(500, ApiResult.Fail("Webhook not configured."));
        }

        // SePay sends "Authorization: Apikey <key>"; tolerate a bare key too.
        var auth = Request.Headers.Authorization.ToString();
        const string prefix = "Apikey ";
        var providedKey = auth.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            ? auth[prefix.Length..].Trim()
            : auth.Trim();
        if (!CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(providedKey), Encoding.UTF8.GetBytes(expectedKey)))
            return Unauthorized(ApiResult.Fail("Invalid API key."));

        // Only confirm incoming transfers; ignore outgoing money movements.
        if (!string.Equals(req.TransferType, "in", StringComparison.OrdinalIgnoreCase))
            return Ok(ApiResult.Ok(new { matched = false, reason = "ignored_non_incoming" }));

        // The DR-XXXX code may land in any of these text fields depending on the bank.
        var matchText = string.Join(" ",
            new[] { req.Code, req.Content, req.Description }.Where(s => !string.IsNullOrWhiteSpace(s)));
        DateTime? txDate = DateTime.TryParse(req.TransactionDate, out var parsed) ? parsed : null;

        var mapped = new BankWebhookRequest(
            Gateway: req.Gateway,
            TransactionDate: txDate,
            AccountNumber: req.AccountNumber,
            Content: matchText,
            Amount: req.TransferAmount,
            Reference: req.ReferenceCode);

        var rawJson = JsonSerializer.Serialize(req, JsonOptions);
        var (payment, reason) = await _bank.MatchAndConfirmAsync(mapped, rawJson, ct);

        _logger.LogInformation("SePay webhook: reason={Reason}, paymentId={PaymentId}, sepayId={SePayId}", reason, payment?.Id, req.Id);
        return Ok(ApiResult.Ok(new { matched = payment is not null, reason, paymentId = payment?.Id }));
    }
}
