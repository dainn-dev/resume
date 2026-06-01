namespace DResume.Api.Contracts;

public sealed record ParseResumeRequest(string ResumeText);

public sealed record JobMatchRequest(
    string ResumeText,
    string? JobDescription,
    string? LinkedinUrl,
    Guid? ResumeId);

public sealed record JobMatchResponse(
    JobMatchAnalysisDto Analysis,
    string JobDescription,
    Guid? Id);

public sealed record JobMatchRenameRequest(string? Title);

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

// Company Review
public sealed record CompanyReviewRequest(string CompanyName);

public sealed record CompanyInfoDto(
    string Name,
    double? Rating,
    int? EmployeeCount,
    string? Industry,
    string? Headquarters,
    List<BenefitDto>? Benefits = null,
    List<ControversyDto>? Controversies = null);

public sealed record BenefitDto(string Name, bool Highlight, string? Category);

/// <summary>
/// A company-level controversy / "drama" (layoffs, unpaid wages, lawsuits, leadership scandal,
/// mass resignations, etc.) — distinct from an individual employee review.
/// </summary>
public sealed record ControversyDto(
    string Title,
    string? Summary,
    string? Severity,
    string? Date,
    string? Category);

public sealed record ReviewItemDto(
    string Source,
    string? ReviewerName,
    string? ReviewerPosition,
    double? Rating,
    string? Pros,
    string? Cons,
    string? Date,
    string? Url);

public sealed record SourceStatusDto(string Source, string Status, int ReviewCount, string? Error);

public sealed record CompanyReviewResponse(
    CompanyInfoDto Info,
    List<ReviewItemDto> Reviews,
    List<SourceStatusDto> Sources,
    bool FromCache,
    int LimitApplied,
    int TotalAvailable);

public sealed record TopTechCompanyDto(
    string Name,
    double? Rating,
    string? Industry,
    string? Headquarters,
    string? Summary,
    List<string> Perks);

public sealed record TopTechResponse(
    List<TopTechCompanyDto> Companies,
    string Region,
    bool FromCache);
