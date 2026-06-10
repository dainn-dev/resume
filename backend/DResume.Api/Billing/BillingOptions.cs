namespace DResume.Api.Billing;

public sealed class BillingOptions
{
    // Bank QR (VietQR) transfer is the sole payment method. Card payments were removed.
    public bool BankQrEnabled { get; set; } = true;

    // Test-only: a cheap 1-day Pro purchase to validate the QR → confirm flow end to end.
    // Represented by DurationMonths == 0. Keep disabled in production.
    public bool TestPlanEnabled { get; set; } = false;
    public long TestPlanPriceVnd { get; set; } = 2000;
}
