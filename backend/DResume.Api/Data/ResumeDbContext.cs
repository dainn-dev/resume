using DResume.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Data;

public class ResumeDbContext : DbContext
{
    public ResumeDbContext(DbContextOptions<ResumeDbContext> options) : base(options) { }

    public DbSet<Resume> Resumes => Set<Resume>();
    public DbSet<ResumeAnalysisRecord> ResumeAnalyses => Set<ResumeAnalysisRecord>();
    public DbSet<JobMatchRecord> JobMatches => Set<JobMatchRecord>();
    public DbSet<CoverLetter> CoverLetters => Set<CoverLetter>();
    public DbSet<CareerCoachSession> CareerCoachSessions => Set<CareerCoachSession>();
    public DbSet<InterviewCoachSession> InterviewCoachSessions => Set<InterviewCoachSession>();
    public DbSet<SalaryEstimateRecord> SalaryEstimates => Set<SalaryEstimateRecord>();
    public DbSet<ResumeBuild> ResumeBuilds => Set<ResumeBuild>();
    public DbSet<UserSubscription> UserSubscriptions => Set<UserSubscription>();
    public DbSet<CalendarGoal> CalendarGoals => Set<CalendarGoal>();
    public DbSet<CalendarMilestone> CalendarMilestones => Set<CalendarMilestone>();
    public DbSet<CalendarTask> CalendarTasks => Set<CalendarTask>();
    public DbSet<CompanyReviewCacheRecord> CompanyReviewCaches => Set<CompanyReviewCacheRecord>();
    public DbSet<PlanRecord> Plans => Set<PlanRecord>();
    public DbSet<BankPricingTier> BankPricingTiers => Set<BankPricingTier>();
    public DbSet<BankAccount> BankAccounts => Set<BankAccount>();
    public DbSet<BankPayment> BankPayments => Set<BankPayment>();
    public DbSet<BugReport> BugReports => Set<BugReport>();
    public DbSet<AiUsageRecord> AiUsages => Set<AiUsageRecord>();
    public DbSet<AiProvider> AiProviders => Set<AiProvider>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema("resume");

        b.Entity<Resume>(e =>
        {
            e.ToTable("resumes");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => new { x.UserId, x.FileHash }).HasFilter("\"FileHash\" IS NOT NULL");
            e.Property(x => x.RawText).HasColumnType("text");
            e.Property(x => x.ParsedDataJson).HasColumnType("jsonb");
            e.Property(x => x.FileHash).HasMaxLength(64);
            e.HasMany(x => x.Analyses).WithOne(x => x.Resume!).HasForeignKey(x => x.ResumeId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ResumeAnalysisRecord>(e =>
        {
            e.ToTable("resume_analyses");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.ResumeId);
            e.Property(x => x.ResultJson).HasColumnType("jsonb");
        });

        b.Entity<JobMatchRecord>(e =>
        {
            e.ToTable("job_matches");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.UserId);
            e.Property(x => x.JobDescription).HasColumnType("text");
            e.Property(x => x.ResultJson).HasColumnType("jsonb");
        });

        b.Entity<CoverLetter>(e =>
        {
            e.ToTable("cover_letters");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.UserId);
            e.Property(x => x.InputJson).HasColumnType("jsonb");
            e.Property(x => x.BodyText).HasColumnType("text");
        });

        b.Entity<CareerCoachSession>(e =>
        {
            e.ToTable("career_coach_sessions");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.UserId);
            e.Property(x => x.InputJson).HasColumnType("jsonb");
            e.Property(x => x.ResultJson).HasColumnType("jsonb");
            e.Property(x => x.Analysis).HasColumnType("text");
        });

        b.Entity<InterviewCoachSession>(e =>
        {
            e.ToTable("interview_coach_sessions");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.UserId);
            e.Property(x => x.InputJson).HasColumnType("jsonb");
            e.Property(x => x.ResultJson).HasColumnType("jsonb");
            e.Property(x => x.Analysis).HasColumnType("text");
        });

        b.Entity<ResumeBuild>(e =>
        {
            e.ToTable("resume_builds");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.UserId, x.InputHash });
            e.Property(x => x.InputHash).HasMaxLength(64);
            e.Property(x => x.Markdown).HasColumnType("text");
        });

        b.Entity<SalaryEstimateRecord>(e =>
        {
            e.ToTable("salary_estimates");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.UserId);
            e.Property(x => x.InputJson).HasColumnType("jsonb");
            e.Property(x => x.EstimateJson).HasColumnType("jsonb");
            e.Property(x => x.Analysis).HasColumnType("text");
        });

        b.Entity<CalendarGoal>(e =>
        {
            e.ToTable("calendar_goals");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.UserId);
            e.Property(x => x.Status).HasMaxLength(20);
            e.HasMany(x => x.Milestones).WithOne(x => x.Goal!).HasForeignKey(x => x.GoalId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<CalendarMilestone>(e =>
        {
            e.ToTable("calendar_milestones");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.GoalId);
            e.HasMany(x => x.Tasks).WithOne(x => x.Milestone!).HasForeignKey(x => x.MilestoneId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<CalendarTask>(e =>
        {
            e.ToTable("calendar_tasks");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.MilestoneId);
        });

        b.Entity<UserSubscription>(e =>
        {
            e.ToTable("user_subscriptions");
            e.HasKey(x => x.UserId);
            e.HasIndex(x => x.StripeCustomerId);
            e.HasIndex(x => x.StripeSubscriptionId);
            e.Property(x => x.PlanCode).HasConversion<int>();
            e.Property(x => x.Status).HasMaxLength(40);
        });

        b.Entity<CompanyReviewCacheRecord>(e =>
        {
            e.ToTable("company_review_cache");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.CompanyKey).IsUnique();
            e.Property(x => x.CompanyKey).HasMaxLength(200);
            e.Property(x => x.DataJson).HasColumnType("jsonb");
        });

        b.Entity<PlanRecord>(e =>
        {
            e.ToTable("plans");
            e.HasKey(x => x.Code);
            e.Property(x => x.Code).HasConversion<int>();
            e.HasIndex(x => x.LookupKey).IsUnique();
            e.Property(x => x.LookupKey).HasMaxLength(60);
            e.Property(x => x.Name).HasMaxLength(80);
            e.Property(x => x.Currency).HasMaxLength(8);
            e.Property(x => x.ActiveStripePriceId).HasMaxLength(128);
        });

        b.Entity<BankPricingTier>(e =>
        {
            e.ToTable("bank_pricing_tiers");
            e.HasKey(x => x.Id);
            e.Property(x => x.PlanCode).HasConversion<int>();
            e.HasIndex(x => new { x.PlanCode, x.Months }).IsUnique();
        });

        b.Entity<BankAccount>(e =>
        {
            e.ToTable("bank_accounts");
            e.HasKey(x => x.Id);
            e.Property(x => x.BankBin).HasMaxLength(16);
            e.Property(x => x.BankCode).HasMaxLength(16);
            e.Property(x => x.BankName).HasMaxLength(120);
            e.Property(x => x.AccountNumber).HasMaxLength(40);
            e.Property(x => x.AccountHolder).HasMaxLength(120);
            e.HasIndex(x => x.IsDefault);
            e.HasIndex(x => x.IsActive);
        });

        b.Entity<BankPayment>(e =>
        {
            e.ToTable("bank_payments");
            e.HasKey(x => x.Id);
            e.Property(x => x.PlanCode).HasConversion<int>();
            e.Property(x => x.Status).HasConversion<int>();
            e.Property(x => x.TransactionCode).HasMaxLength(40);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.TransactionCode).IsUnique();
            e.HasIndex(x => x.Status);
            e.Property(x => x.WebhookRaw).HasColumnType("jsonb");
            e.Property(x => x.Notes).HasColumnType("text");
            e.HasOne(x => x.BankAccount).WithMany().HasForeignKey(x => x.BankAccountId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<AiUsageRecord>(e =>
        {
            e.ToTable("ai_usage");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.UserId, x.Period }).IsUnique();
            e.Property(x => x.Period).HasMaxLength(6);
        });

        b.Entity<AiProvider>(e =>
        {
            e.ToTable("ai_providers");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(100);
            e.Property(x => x.BaseUrl).HasMaxLength(500);
            e.Property(x => x.ApiKey).HasMaxLength(500);
            e.Property(x => x.ModelsJson).HasColumnType("jsonb");
        });

        b.Entity<BugReport>(e =>
        {
            e.ToTable("bug_reports");
            e.HasKey(x => x.Id);
            e.Property(x => x.Severity).HasConversion<int>();
            e.Property(x => x.Status).HasConversion<int>();
            e.Property(x => x.Title).HasMaxLength(200);
            e.Property(x => x.ReporterEmail).HasMaxLength(256);
            e.Property(x => x.Category).HasMaxLength(40);
            e.Property(x => x.PageUrl).HasMaxLength(2048);
            e.Property(x => x.UserAgent).HasMaxLength(512);
            e.Property(x => x.Description).HasColumnType("text");
            e.Property(x => x.AdminNotes).HasColumnType("text");
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.CreatedAt);
        });
    }
}

public class ResumeDbContextFactory : Microsoft.EntityFrameworkCore.Design.IDesignTimeDbContextFactory<ResumeDbContext>
{
    public ResumeDbContext CreateDbContext(string[] args)
    {
        var config = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddJsonFile("appsettings.Local.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var conn = config["Resume:ConnectionString"]
                   ?? "Host=localhost;Port=5432;Database=dresume;Username=dresume;Password=dresume";

        var options = new DbContextOptionsBuilder<ResumeDbContext>()
            .UseNpgsql(conn, o => o.MigrationsHistoryTable("__EFMigrationsHistory", "resume"))
            .Options;

        return new ResumeDbContext(options);
    }
}
