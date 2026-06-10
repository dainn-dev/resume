namespace DResume.Api.Common;

/// <summary>
/// Fail-fast validation of security-critical configuration at startup.
///
/// The goal is to turn silent misconfiguration (empty signing secret, a production
/// instance still pointed at the MailHog dev SMTP, etc.) into a hard refuse-to-start
/// with a clear log line, so the app cannot be deployed in an insecure shape.
///
/// Run this immediately after the configuration sources are wired (including the
/// optional appsettings.Local.json / environment-variable overrides) and BEFORE
/// <c>builder.Build()</c>. On failure it writes every problem to stderr and throws a
/// <see cref="StartupConfigValidationException"/>, which leaves the process with a
/// non-zero exit code and prevents the host from ever starting.
/// </summary>
public static class StartupConfigValidator
{
    // Hosts that only make sense in local dev. A production instance pointed at any of
    // these will silently swallow every outbound email (verification, password reset,
    // billing receipts), so we refuse to start.
    private static readonly string[] DevSmtpHosts = { "mailhog", "localhost", "127.0.0.1", "" };

    // HS256 needs a key with at least 256 bits of entropy; anything shorter weakens the
    // signature regardless of environment.
    private const int MinJwtSecretLength = 32;

    /// <summary>
    /// Validate security-critical configuration. Throws
    /// <see cref="StartupConfigValidationException"/> if anything is missing or unsafe.
    /// </summary>
    public static void Validate(IConfiguration config, IHostEnvironment env)
    {
        var isProduction = env.IsProduction();
        var errors = new List<string>();

        // --- JWT signing secret (gap: appsettings.json:16) ---------------------------
        // An empty secret means tokens are signed with nothing — auth is effectively
        // bypassable. This is unsafe in every environment, so fail regardless of env.
        var jwtSecret = config["DainnUser:Jwt:Secret"];
        if (string.IsNullOrWhiteSpace(jwtSecret))
        {
            errors.Add("DainnUser:Jwt:Secret is empty. Set a strong random secret "
                + "(env: DainnUser__Jwt__Secret). The app refuses to start without a JWT signing key.");
        }
        else if (jwtSecret.Trim().Length < MinJwtSecretLength)
        {
            errors.Add($"DainnUser:Jwt:Secret is too short ({jwtSecret.Trim().Length} chars). "
                + $"Use at least {MinJwtSecretLength} characters (256 bits) for the HS256 signing key "
                + "(env: DainnUser__Jwt__Secret).");
        }

        // --- SMTP host (gap: appsettings.json:27-28) ---------------------------------
        // A production deployment still pointing at the MailHog/localhost dev SMTP would
        // drop every transactional email on the floor. Block it in Production only —
        // local dev legitimately uses MailHog.
        if (isProduction)
        {
            var smtpHost = (config["DainnUser:Email:SmtpHost"] ?? string.Empty).Trim();
            if (DevSmtpHosts.Contains(smtpHost, StringComparer.OrdinalIgnoreCase))
            {
                var shown = smtpHost.Length == 0 ? "<empty>" : smtpHost;
                errors.Add($"DainnUser:Email:SmtpHost is '{shown}', a development default, while "
                    + "ASPNETCORE_ENVIRONMENT=Production. Point it at a real SMTP host "
                    + "(env: DainnUser__Email__SmtpHost) so transactional emails are actually delivered.");
            }
        }

        // NOTE: Encryption:Key enforcement is intentionally owned by P0-3 (PII encryption).
        // When that lands, add its check here so all fail-fast config lives in one place.

        if (errors.Count == 0)
        {
            return;
        }

        var header = $"FATAL: startup configuration validation failed ({errors.Count} problem(s)) "
            + $"[environment={env.EnvironmentName}]:";
        Console.Error.WriteLine(header);
        for (var i = 0; i < errors.Count; i++)
        {
            Console.Error.WriteLine($"  {i + 1}. {errors[i]}");
        }
        Console.Error.WriteLine("Aborting startup. Fix the configuration above and restart.");

        throw new StartupConfigValidationException(header + Environment.NewLine
            + string.Join(Environment.NewLine, errors.Select((e, i) => $"  {i + 1}. {e}")));
    }
}

/// <summary>
/// Thrown when security-critical startup configuration is missing or unsafe. Unhandled
/// by design so the host crashes with a non-zero exit code instead of starting.
/// </summary>
public sealed class StartupConfigValidationException : Exception
{
    public StartupConfigValidationException(string message) : base(message) { }
}
