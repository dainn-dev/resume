namespace DResume.Api.Billing;

public sealed class BillingOptions
{
    public string SuccessUrl { get; set; } = "http://localhost:3000/account?checkout=success&session_id={CHECKOUT_SESSION_ID}";
    public string CancelUrl { get; set; } = "http://localhost:3000/account?checkout=cancel";
    public bool SeedCatalogOnStartup { get; set; } = true;
}
