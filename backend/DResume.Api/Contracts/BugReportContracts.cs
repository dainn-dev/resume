using DResume.Api.Data.Entities;

namespace DResume.Api.Contracts;

/// <summary>Payload submitted from the public Report a Bug form.</summary>
public sealed class SubmitBugReportRequest
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public BugSeverity Severity { get; set; } = BugSeverity.Medium;
    public string? Category { get; set; }
    public string? PageUrl { get; set; }
    /// <summary>Only used for anonymous reporters; ignored when authenticated.</summary>
    public string? Email { get; set; }
}

public sealed class BugReportDto
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string? ReporterEmail { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public BugSeverity Severity { get; set; }
    public string? Category { get; set; }
    public string? PageUrl { get; set; }
    public string? UserAgent { get; set; }
    public BugReportStatus Status { get; set; }
    public string? AdminNotes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public static BugReportDto From(BugReport r) => new()
    {
        Id = r.Id,
        UserId = r.UserId,
        ReporterEmail = r.ReporterEmail,
        Title = r.Title,
        Description = r.Description,
        Severity = r.Severity,
        Category = r.Category,
        PageUrl = r.PageUrl,
        UserAgent = r.UserAgent,
        Status = r.Status,
        AdminNotes = r.AdminNotes,
        CreatedAt = r.CreatedAt,
        UpdatedAt = r.UpdatedAt,
    };
}

public sealed class BugReportListResponse
{
    public int Total { get; set; }
    public int Page { get; set; }
    public int Size { get; set; }
    public int NewCount { get; set; }
    public List<BugReportDto> Reports { get; set; } = new();
}

/// <summary>Admin triage update — any non-null field is applied.</summary>
public sealed class UpdateBugReportRequest
{
    public BugReportStatus? Status { get; set; }
    public string? AdminNotes { get; set; }
}
