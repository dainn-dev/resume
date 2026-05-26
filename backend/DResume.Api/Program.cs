using DainnStripe;
using DainnStripe.Data;
using DainnStripe.Interfaces;
using DainnUser.Infrastructure;
using DainnUser.Infrastructure.Data;
using DResume.Api.Ai;
using DResume.Api.Billing;
using DResume.Api.Common;
using DResume.Api.Data;
using DResume.Api.DocumentParsing;
using DResume.Api.Features.Build;
using DResume.Api.Features.Coach;
using DResume.Api.Features.CoverLetter;
using DResume.Api.Features.JobMatch;
using DResume.Api.Features.Resumes;
using DResume.Api.Features.Salary;
using DResume.Api.Features.Translation;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

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
    opts.EnableSocialLogin = false;
    opts.EnableTwoFactor = false;
    opts.EnableGenericOidc = false;
});

builder.Services.AddDbContext<ResumeDbContext>(o =>
    o.UseNpgsql(
        builder.Configuration["Resume:ConnectionString"]
            ?? throw new InvalidOperationException("Resume:ConnectionString is not configured."),
        npg => npg.MigrationsHistoryTable("__EFMigrationsHistory", "resume")));

builder.Services.Configure<AnthropicOptions>(builder.Configuration.GetSection("Anthropic"));
builder.Services.AddHttpClient<IAnthropicClient, AnthropicClient>();
builder.Services.AddHttpClient("jd-scraper");

builder.Services.AddSingleton<IDocumentParser, DocumentParser>();
builder.Services.AddScoped<IResumeAnalysisService, ResumeAnalysisService>();
builder.Services.AddScoped<IJobMatchService, JobMatchService>();
builder.Services.AddScoped<IResumeBuildService, ResumeBuildService>();
builder.Services.AddScoped<ICoverLetterService, CoverLetterService>();
builder.Services.AddScoped<ICareerCoachService, CareerCoachService>();
builder.Services.AddScoped<IInterviewCoachService, InterviewCoachService>();
builder.Services.AddScoped<ISalaryEstimateService, SalaryEstimateService>();
builder.Services.AddScoped<ITranslationService, TranslationService>();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();

var stripeSecretKey = builder.Configuration["DainnStripe:SecretKey"];
var stripeEnabled = !string.IsNullOrWhiteSpace(stripeSecretKey);
if (stripeEnabled)
{
    builder.Services.AddDainnStripe(builder.Configuration);
    builder.Services.AddScoped<IStripeCatalogSeeder, StripeCatalogSeeder>();
    builder.Services.AddScoped<IStripeWebhookHandler, PlanWebhookHandler>();
}
builder.Services.Configure<BillingOptions>(builder.Configuration.GetSection("Billing"));
builder.Services.AddScoped<IPlanService, PlanService>();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:3000" };
builder.Services.AddCors(o => o.AddPolicy("Frontend", p => p
    .WithOrigins(allowedOrigins)
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

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseCors("Frontend");
app.UseDainnUser();
if (stripeEnabled)
{
    app.UseDainnStripe();
    app.MapDainnStripeWebhooks(builder.Configuration["DainnStripe:WebhookPath"] ?? "/api/billing/webhook");
}
else
{
    app.Logger.LogWarning("DainnStripe disabled: 'DainnStripe:SecretKey' is not configured. Billing endpoints will return 500 if called.");
}
app.MapControllers();

await using (var scope = app.Services.CreateAsyncScope())
{
    var resumeDb = scope.ServiceProvider.GetRequiredService<ResumeDbContext>();
    await resumeDb.Database.MigrateAsync();

    var dainnDb = scope.ServiceProvider.GetService<DainnUserDbContext>();
    if (dainnDb is null)
    {
        app.Logger.LogError("DainnUserDbContext is not registered in the service provider.");
    }
    else
    {
        await EnsureDainnUserSchemaAsync(dainnDb, app.Logger);
    }

    try
    {
        var stripeDb = scope.ServiceProvider.GetService<DainnStripeDbContext>();
        if (stripeDb is not null)
            await stripeDb.Database.MigrateAsync();
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "DainnStripeDbContext migration skipped: {Message}", ex.Message);
    }

    var billingOptions = scope.ServiceProvider.GetRequiredService<IOptions<BillingOptions>>().Value;
    if (billingOptions.SeedCatalogOnStartup
        && !string.IsNullOrWhiteSpace(builder.Configuration["DainnStripe:SecretKey"]))
    {
        try
        {
            var seeder = scope.ServiceProvider.GetRequiredService<IStripeCatalogSeeder>();
            await seeder.SeedAsync();
        }
        catch (Exception ex)
        {
            app.Logger.LogWarning(ex, "Stripe catalog seeding skipped: {Message}", ex.Message);
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
