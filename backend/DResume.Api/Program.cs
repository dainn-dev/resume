using DainnUser.Core.Interfaces.Services;
using DainnUser.Infrastructure;
using DainnUser.Infrastructure.Data;
using DResume.Api.Features.Email;
using DResume.Api.Ai;
using DResume.Api.Billing;
using DResume.Api.Common;
using DResume.Api.Common.Encryption;
using DResume.Api.Data;
using DResume.Api.DocumentParsing;
using DResume.Api.Features.Build;
using DResume.Api.Features.Coach;
using DResume.Api.Features.CoverLetter;
using DResume.Api.Features.JobMatch;
using DResume.Api.Features.Resumes;
using DResume.Api.Features.Salary;
using DResume.Api.Features.Calendar;
using DResume.Api.Features.CompanyReview;
using DResume.Api.Features.Portfolio;
using DResume.Api.Security;
using DResume.Api.Features.CompanyReview.Sources;
using DResume.Api.Features.Translation;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Local-only secret overrides (git-ignored). Keeps real keys/connection strings out of the
// committed appsettings.json. Optional so deployments relying on env vars are unaffected.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

// Fail-fast: refuse to start if security-critical config (JWT secret, SMTP host) is
// missing or unsafe. Runs after all config sources (incl. env vars / Local.json) are
// wired and before the host is built, so a misconfigured instance never comes up.
StartupConfigValidator.Validate(builder.Configuration, builder.Environment);

// P0-3: PII field encryption is mandatory. Refuse to start when Encryption:Key is missing or
// invalid so resume rawtext and bank account numbers are never silently persisted as plaintext.
AesFieldEncryptor.EnsureKeyConfigured(builder.Configuration);

builder.Services.Configure<KestrelServerOptions>(o => o.Limits.MaxRequestBodySize = 15 * 1024 * 1024);
builder.Services.Configure<FormOptions>(o =>
{
    o.MultipartBodyLengthLimit = 15 * 1024 * 1024;
    o.ValueLengthLimit = int.MaxValue;
});

builder.Services.AddDainnUser(builder.Configuration, opts =>
{
    opts.RequireEmailVerification = true;
    opts.EnableAccountLockout = true;
    opts.EnableSessionManagement = true;
    opts.EnableActivityLogging = true;
    opts.EnableRateLimiting = true;
    opts.EnableSocialLogin = true;
    opts.GoogleClientId = builder.Configuration["DainnUser:GoogleClientId"] ?? string.Empty;
    opts.GoogleClientSecret = builder.Configuration["DainnUser:GoogleClientSecret"] ?? string.Empty;
    var googleCallbackPath = builder.Configuration["DainnUser:GoogleCallbackPath"];
    if (!string.IsNullOrWhiteSpace(googleCallbackPath)) opts.GoogleCallbackPath = googleCallbackPath;
    opts.EnableTwoFactor = false;
    opts.EnableGenericOidc = false;
});
builder.Services.AddScoped<IEmailService, DResumeEmailService>();

builder.Services.AddDbContext<ResumeDbContext>(o =>
    o.UseNpgsql(
        builder.Configuration["Resume:ConnectionString"]
            ?? throw new InvalidOperationException("Resume:ConnectionString is not configured."),
        npg => npg.MigrationsHistoryTable("__EFMigrationsHistory", "resume")));

builder.Services.Configure<AnthropicOptions>(builder.Configuration.GetSection("Anthropic"));
builder.Services.AddSingleton<IAiProviderService, AiProviderService>();
builder.Services.AddHttpClient<IAnthropicClient, AnthropicClient>();
builder.Services.Configure<RecaptchaOptions>(builder.Configuration.GetSection("Recaptcha"));
builder.Services.AddHttpClient<IRecaptchaVerifier, RecaptchaVerifier>();
builder.Services.AddHttpClient("jd-scraper");
builder.Services.AddHttpClient("company-scraper", c => c.Timeout = TimeSpan.FromSeconds(15))
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
    {
        AutomaticDecompression = System.Net.DecompressionMethods.GZip | System.Net.DecompressionMethods.Deflate | System.Net.DecompressionMethods.Brotli,
        UseCookies = true,
        CookieContainer = new System.Net.CookieContainer(),
    });

builder.Services.AddSingleton<IFieldEncryptor, AesFieldEncryptor>();
builder.Services.AddSingleton<IDocumentParser, DocumentParser>();
builder.Services.AddSingleton<IFileStorageService, FileStorageService>();
builder.Services.AddScoped<IResumeAnalysisService, ResumeAnalysisService>();
builder.Services.AddScoped<IJobMatchService, JobMatchService>();
builder.Services.AddScoped<IResumeBuildService, ResumeBuildService>();
builder.Services.AddScoped<ICoverLetterService, CoverLetterService>();
builder.Services.AddScoped<ICareerCoachService, CareerCoachService>();
builder.Services.AddScoped<IInterviewCoachService, InterviewCoachService>();
builder.Services.AddScoped<ISalaryEstimateService, SalaryEstimateService>();
builder.Services.AddScoped<ITranslationService, TranslationService>();
builder.Services.AddScoped<ITaskGeneratorService, TaskGeneratorService>();
builder.Services.AddScoped<ICompanyReviewSource, ClaudeSynthesisSource>();
builder.Services.AddScoped<ICompanyReviewSource, ITViecSource>();
builder.Services.AddScoped<ICompanyReviewService, CompanyReviewService>();
builder.Services.AddScoped<IPortfolioService, PortfolioService>();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();

// P0-4: per-second/minute throttles on AI + auth endpoints (returns 429). Independent of the
// monthly AI quota — see RateLimitingExtensions for the policy definitions and cluster-safe note.
builder.Services.AddDResumeRateLimiting(builder.Configuration);

// P0-5: security response headers (HSTS / X-Frame-Options / nosniff / CSP). See SecurityHeadersExtensions.
builder.Services.AddDResumeSecurityHeaders(builder.Configuration);

builder.Services.Configure<BillingOptions>(builder.Configuration.GetSection("Billing"));
builder.Services.AddMemoryCache();
builder.Services.AddScoped<IPlanCatalogService, PlanCatalogService>();
builder.Services.AddScoped<IPlanService, PlanService>();
builder.Services.AddScoped<IUsageService, UsageService>();
builder.Services.AddScoped<IBankPricingService, BankPricingService>();
builder.Services.AddScoped<IBankPaymentService, BankPaymentService>();
builder.Services.AddScoped<IBillingNotifier, BillingNotifier>();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:3000" };
// Portfolio sites are served from wildcard subdomains (*.dainn.online); allow any of them in
// addition to the explicit origins. The frontend proxies most calls (same-origin), so this is a
// safety net for any direct browser→backend request from a portfolio subdomain.
var portfolioBaseDomain = builder.Configuration["Portfolio:BaseDomain"];
builder.Services.AddCors(o => o.AddPolicy("Frontend", p => p
    .SetIsOriginAllowed(origin =>
    {
        if (allowedOrigins.Contains(origin)) return true;
        if (string.IsNullOrWhiteSpace(portfolioBaseDomain)) return false;
        return Uri.TryCreate(origin, UriKind.Absolute, out var u)
            && (u.Host.Equals(portfolioBaseDomain, StringComparison.OrdinalIgnoreCase)
                || u.Host.EndsWith($".{portfolioBaseDomain}", StringComparison.OrdinalIgnoreCase));
    })
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "DResume API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the access token without the 'Bearer ' prefix."
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        }
    });
});

builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Add security headers first so they're present on every response, including error responses.
app.UseDResumeSecurityHeaders();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseCors("Frontend");
app.UseDainnUser();
// After auth so the AI policy can partition by authenticated user id; before endpoints execute.
app.UseRateLimiter();
app.MapControllers();

await using (var scope = app.Services.CreateAsyncScope())
{
    var resumeDb = scope.ServiceProvider.GetRequiredService<ResumeDbContext>();
    await resumeDb.Database.MigrateAsync();

    // Encrypt any pre-existing plaintext PII rows (idempotent; no-op once all rows are encrypted).
    try
    {
        var encryptor = scope.ServiceProvider.GetRequiredService<IFieldEncryptor>();
        await PiiEncryptionBackfill.RunAsync(resumeDb, encryptor, app.Logger);
    }
    catch (Exception ex) { app.Logger.LogError(ex, "PII encryption backfill failed."); }

    // Bootstrap plans table from PlanCatalog defaults if empty
    try { await scope.ServiceProvider.GetRequiredService<IPlanCatalogService>().SeedIfEmptyAsync(); }
    catch (Exception ex) { app.Logger.LogWarning(ex, "Plan catalog seed skipped."); }

    // Bootstrap bank-transfer pricing tiers (1/3/6/12 months) for paid plans if none exist
    try { await scope.ServiceProvider.GetRequiredService<IBankPricingService>().SeedDefaultsIfEmptyAsync(); }
    catch (Exception ex) { app.Logger.LogWarning(ex, "Bank pricing tier seed skipped."); }

    var dainnDb = scope.ServiceProvider.GetService<DainnUserDbContext>();
    if (dainnDb is null)
    {
        app.Logger.LogError("DainnUserDbContext is not registered in the service provider.");
    }
    else
    {
        await EnsureDainnUserSchemaAsync(dainnDb, app.Logger);
    }

    // Seed admin accounts
    var adminEmails = builder.Configuration.GetSection("Admin:Emails").Get<string[]>() ?? [];
    var adminPassword = builder.Configuration["Admin:DefaultPassword"];
    if (adminEmails.Length > 0 && dainnDb is not null && string.IsNullOrWhiteSpace(adminPassword))
    {
        // Never seed admins with a hardcoded/default password. Require Admin:DefaultPassword
        // (e.g. via the ADMIN__DEFAULTPASSWORD env var). Skip seeding when it is not provided.
        app.Logger.LogWarning(
            "Admin seeding skipped: {Count} admin email(s) configured but Admin:DefaultPassword is not set. " +
            "Set the Admin:DefaultPassword configuration value to enable admin account seeding.",
            adminEmails.Length);
    }
    else if (adminEmails.Length > 0 && dainnDb is not null)
    {
        var auth = scope.ServiceProvider.GetRequiredService<IAuthenticationService>();
        foreach (var email in adminEmails)
        {
            try
            {
                await auth.RegisterAsync(email, email.Split('@')[0], adminPassword);
                app.Logger.LogInformation("Admin account created: {Email}", email);
            }
            catch { /* Already exists */ }

            try
            {
                await dainnDb.Database.ExecuteSqlRawAsync(
                    "UPDATE public.\"Users\" SET \"EmailVerified\" = true WHERE \"Email\" = {0}", email);
            }
            catch { /* Column may not exist or already verified */ }
        }
    }
}

app.Run();

static async Task EnsureDainnUserSchemaAsync(DainnUserDbContext db, ILogger logger)
{
    const string roleTableExistsSql = """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_name = 'Roles'
        ) AS "Value"
        """;

    if (await db.Database.CanConnectAsync())
    {
        var rolesTableExists = await db.Database.SqlQueryRaw<bool>(roleTableExistsSql).SingleAsync();
        if (rolesTableExists)
        {
            logger.LogInformation("DainnUser schema already exists.");
            return;
        }

        var creator = db.GetService<IRelationalDatabaseCreator>();
        await creator.CreateTablesAsync();
        logger.LogInformation("DainnUser schema created from the PostgreSQL model.");
        return;
    }

    await db.Database.EnsureCreatedAsync();
    logger.LogInformation("DainnUser database and schema created from the PostgreSQL model.");
}
