using DResume.Api.Billing;

namespace DResume.Api.Data.Entities;

public class BankAccount
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string BankBin { get; set; } = string.Empty;
    public string BankCode { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string AccountHolder { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public bool IsDefault { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public enum BankPaymentStatus
{
    Pending = 0,
    Confirmed = 1,
    Failed = 2,
    Cancelled = 3,
    Expired = 4,
}

public class BankPayment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public PlanCode PlanCode { get; set; }
    public int DurationMonths { get; set; }
    public long AmountVnd { get; set; }
    public string TransactionCode { get; set; } = string.Empty;
    public Guid BankAccountId { get; set; }
    public BankAccount? BankAccount { get; set; }
    public BankPaymentStatus Status { get; set; } = BankPaymentStatus.Pending;
    public DateTime? PaidAt { get; set; }
    public string? ConfirmedByEmail { get; set; }
    public string? WebhookRaw { get; set; }
    public string? Notes { get; set; }
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddHours(24);
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
