namespace DResume.Api.Data.Entities;

public class Resume
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string? Title { get; set; }
    public string? SourceFileName { get; set; }
    public string RawText { get; set; } = string.Empty;
    public string? ParsedDataJson { get; set; }
    public string? FileHash { get; set; }
    public Guid? LastAnalysisId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<ResumeAnalysisRecord> Analyses { get; set; } = new();
}

public class ResumeAnalysisRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid ResumeId { get; set; }
    public Resume? Resume { get; set; }
    public int Score { get; set; }
    public string ResultJson { get; set; } = "{}";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class JobMatchRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid? ResumeId { get; set; }
    public string? JobDescription { get; set; }
    public string? LinkedInUrl { get; set; }
    public int MatchScore { get; set; }
    public string ResultJson { get; set; } = "{}";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class CoverLetter
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid? ResumeId { get; set; }
    public string JobTitle { get; set; } = string.Empty;
    public string? Company { get; set; }
    public string InputJson { get; set; } = "{}";
    public string BodyText { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class CareerCoachSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string InputJson { get; set; } = "{}";
    public string ResultJson { get; set; } = "{}";
    public string Analysis { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class InterviewCoachSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string InputJson { get; set; } = "{}";
    public string ResultJson { get; set; } = "{}";
    public string Analysis { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ResumeBuild
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string InputHash { get; set; } = string.Empty;
    public string Markdown { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class SalaryEstimateRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string InputJson { get; set; } = "{}";
    public string EstimateJson { get; set; } = "{}";
    public string Analysis { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class CalendarGoal
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Timeline { get; set; }
    public string Status { get; set; } = "not-started";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<CalendarMilestone> Milestones { get; set; } = new();
}

public class CalendarMilestone
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GoalId { get; set; }
    public CalendarGoal? Goal { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? DueDate { get; set; }
    public bool Completed { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<CalendarTask> Tasks { get; set; } = new();
}

public class CalendarTask
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MilestoneId { get; set; }
    public CalendarMilestone? Milestone { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Date { get; set; }
    public bool Completed { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
