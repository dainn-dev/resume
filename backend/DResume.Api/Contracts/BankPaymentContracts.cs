using DResume.Api.Billing;

namespace DResume.Api.Contracts;

// ---- User-facing ----

public sealed record BankCheckoutRequest(string PlanCode, int DurationMonths);

public sealed record BankCheckoutResponse(
    Guid PaymentId,
    string TransactionCode,
    long AmountVnd,
    BankAccountSummaryDto Bank,
    string QrUrl,
    DateTime ExpiresAt,
    string Status);

public sealed record BankAccountSummaryDto(
    string BankCode,
    string BankName,
    string BankBin,
    string AccountNumber,
    string AccountHolder);

public sealed record BankPaymentDetailDto(
    Guid Id,
    string PlanCode,
    int DurationMonths,
    long AmountVnd,
    string TransactionCode,
    BankAccountSummaryDto Bank,
    string QrUrl,
    string Status,
    DateTime? PaidAt,
    DateTime ExpiresAt,
    DateTime CreatedAt);

// ---- Webhook ----

public sealed record BankWebhookRequest(
    string? Gateway,
    DateTime? TransactionDate,
    string? AccountNumber,
    string? Content,
    long? Amount,
    string? Reference);

// SePay webhook payload (https://docs.sepay.vn/tich-hop-webhooks.html).
// Field names match SePay's JSON exactly (matched case-insensitively under Web defaults).
public sealed record SePayWebhookRequest(
    long? Id,
    string? Gateway,
    string? TransactionDate,
    string? AccountNumber,
    string? Code,
    string? Content,
    string? TransferType,      // "in" = tiền vào, "out" = tiền ra
    long? TransferAmount,
    long? Accumulated,
    string? SubAccount,
    string? ReferenceCode,
    string? Description);

// ---- Admin: Bank accounts ----

public sealed record BankAccountDto(
    Guid Id,
    string BankBin,
    string BankCode,
    string BankName,
    string AccountNumber,
    string AccountHolder,
    bool IsActive,
    bool IsDefault,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record CreateBankAccountRequest(
    string BankBin,
    string BankCode,
    string BankName,
    string AccountNumber,
    string AccountHolder,
    bool IsActive,
    bool IsDefault);

public sealed record UpdateBankAccountRequest(
    string? BankBin,
    string? BankCode,
    string? BankName,
    string? AccountNumber,
    string? AccountHolder,
    bool? IsActive,
    bool? IsDefault);

// ---- Admin: Bank payments ----

public sealed record BankPaymentAdminDto(
    Guid Id,
    Guid UserId,
    string? UserEmail,
    string PlanCode,
    int DurationMonths,
    long AmountVnd,
    string TransactionCode,
    BankAccountSummaryDto Bank,
    string Status,
    DateTime? PaidAt,
    string? ConfirmedByEmail,
    string? Notes,
    string? WebhookRaw,
    DateTime ExpiresAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record AdminConfirmPaymentRequest(string? Notes);
