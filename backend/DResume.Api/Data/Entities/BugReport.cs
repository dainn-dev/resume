namespace DResume.Api.Data.Entities;

public enum BugSeverity
{
    Low = 0,
    Medium = 1,
    High = 2,
    Critical = 3,
}

public enum BugReportStatus
{
    New = 0,
    InProgress = 1,
    Resolved = 2,
    Closed = 3,
}

public class BugReport
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Null when the report was submitted by an anonymous (signed-out) visitor.</summary>
    public Guid? UserId { get; set; }

    /// <summary>Reporter email — taken from the session when signed in, otherwise supplied on the form.</summary>
    public string? ReporterEmail { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public BugSeverity Severity { get; set; } = BugSeverity.Medium;

    /// <summary>Free-form area tag, e.g. "ui", "billing", "ai", "account", "other".</summary>
    public string? Category { get; set; }

    /// <summary>Page/URL where the bug was observed.</summary>
    public string? PageUrl { get; set; }

    public string? UserAgent { get; set; }

    public BugReportStatus Status { get; set; } = BugReportStatus.New;

    /// <summary>Internal triage notes, admin-only.</summary>
    public string? AdminNotes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
