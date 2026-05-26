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
