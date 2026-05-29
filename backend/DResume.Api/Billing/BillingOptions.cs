namespace DResume.Api.Billing;

public sealed class BillingOptions
{
    public string SuccessUrl { get; set; } = "http://localhost:3000/account?checkout=success&session_id={CHECKOUT_SESSION_ID}";
    public string CancelUrl { get; set; } = "http://localhost:3000/account?checkout=cancel";
    public bool SeedCatalogOnStartup { get; set; } = true;

    // Which payment methods are offered to users. Card additionally requires a configured
    // Stripe SecretKey to actually work; the /config endpoint folds that in.
    public bool CardPaymentsEnabled { get; set; } = true;
    public bool BankQrEnabled { get; set; } = true;

    // Test-only: a cheap 1-day Pro purchase to validate the QR → confirm flow end to end.
    // Represented by DurationMonths == 0. Keep disabled in production.
    public bool TestPlanEnabled { get; set; } = false;
    public long TestPlanPriceVnd { get; set; } = 2000;
}
