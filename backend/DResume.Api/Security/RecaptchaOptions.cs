namespace DResume.Api.Security;

public sealed class RecaptchaOptions
{
    /// <summary>When false, verification is skipped entirely (handy for local dev without keys).</summary>
    public bool Enabled { get; set; } = false;

    /// <summary>Server-side secret key from the Google reCAPTCHA admin console. Never exposed to the client.</summary>
    public string SecretKey { get; set; } = string.Empty;

    public string VerifyUrl { get; set; } = "https://www.google.com/recaptcha/api/siteverify";
}
