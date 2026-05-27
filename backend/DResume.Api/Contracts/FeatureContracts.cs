namespace DResume.Api.Contracts;

public sealed record ParseResumeRequest(string ResumeText);

public sealed record JobMatchRequest(
    string ResumeText,
    string? JobDescription,
    string? LinkedinUrl);

public sealed record JobMatchResponse(
    JobMatchAnalysisDto Analysis,
    string JobDescription,
    Guid? Id);

public sealed record BuildRequest(ResumeFormDataDto Resume);

public sealed record BuildResponse(string Markdown);

public sealed record CoverLetterResponse(string Text, Guid? Id);

public sealed record CareerCoachResponse(CareerCoachResultDto Result, string Analysis, Guid? Id);

public sealed record InterviewCoachResponse(InterviewCoachResultDto Result, string Analysis, Guid? Id);

public sealed record SalaryEstimatorResponse(SalaryEstimateDto Estimate, string Analysis, Guid? Id);

public sealed record TranslateRequest(object Content, string TargetLocale);

public sealed record CreateResumeResponse(
    Guid Id,
    string? Title,
    string ResumeText,
    ResumeFormDataDto? Parsed,
    ResumeAnalysisDto? Analysis,
    Guid? AnalysisId);

public sealed record ResumeListItem(
    Guid Id,
    string? Title,
    string? SourceFileName,
    int? LastScore,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record ResumeDetail(
    Guid Id,
    string? Title,
    string? SourceFileName,
    string RawText,
    ResumeFormDataDto? Parsed,
    ResumeAnalysisDto? LatestAnalysis,
    DateTime CreatedAt,
    DateTime UpdatedAt);

// Calendar
public sealed record CalendarGoalDto(Guid Id, string Title, string? Description, string? Timeline, string Status, DateTime CreatedAt, DateTime UpdatedAt);
public sealed record CalendarMilestoneDto(Guid Id, Guid GoalId, string Title, string? DueDate, bool Completed, DateTime CreatedAt);
public sealed record CalendarTaskDto(Guid Id, Guid MilestoneId, string Title, string? Date, bool Completed, DateTime CreatedAt);

public sealed record CreateGoalRequest(string Title, string? Description, string? Timeline);
public sealed record UpdateGoalRequest(string? Title, string? Description, string? Timeline, string? Status);
public sealed record CreateMilestoneRequest(Guid GoalId, string Title, string? DueDate);
public sealed record UpdateMilestoneRequest(string? Title, string? DueDate, bool? Completed);
public sealed record CreateTaskRequest(Guid MilestoneId, string Title, string? Date);
public sealed record UpdateTaskRequest(string? Title, string? Date, bool? Completed);

public sealed record CalendarDataResponse(
    List<CalendarGoalDto> Goals,
    List<CalendarMilestoneDto> Milestones,
    List<CalendarTaskDto> Tasks);

public sealed record BulkSaveCalendarRequest(
    List<BulkGoal> Goals,
    List<BulkMilestone> Milestones,
    List<BulkTask> Tasks);

public sealed record BulkGoal(string Id, string Title, string? Description, string? Timeline, string Status);
public sealed record BulkMilestone(string Id, string GoalId, string Title, string? DueDate, bool Completed);
public sealed record BulkTask(string Id, string MilestoneId, string Title, string? Date, bool Completed);

// Task Generation
public sealed record GenerateTasksRequest(Guid MilestoneId, string GoalTitle, string MilestoneTitle, string StartDate, string EndDate, string? Context);
public sealed record GeneratedTaskDto(string Title, string Date);
public sealed record GenerateTasksAiResponse(List<GeneratedTaskDto> Tasks);
