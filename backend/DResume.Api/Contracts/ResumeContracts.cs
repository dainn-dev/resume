using System.Text.Json.Serialization;

namespace DResume.Api.Contracts;

public sealed record Tip(string Problem, string Suggestion);

public sealed record SectionAnalysis(int Score, string Label, List<Tip> Tips);

public sealed record ResumeAnalysisDto(
    int OverallScore,
    string OverallSummary,
    ResumeSections Sections);

public sealed record ResumeSections(
    SectionAnalysis ContactInfo,
    SectionAnalysis Summary,
    SectionAnalysis WorkExperience,
    SectionAnalysis Education,
    SectionAnalysis Skills,
    SectionAnalysis Formatting);

public sealed record WorkEntryDto(
    string Company,
    [property: JsonPropertyName("projectName")] string? ProjectName,
    string Title,
    string StartDate,
    string EndDate,
    List<string> Bullets);

public sealed record EducationEntryDto(
    string School,
    string Degree,
    string GraduationYear,
    string? Gpa);

public sealed record ResumeFormDataDto(
    string FullName,
    string Email,
    string Phone,
    string Location,
    string? LinkedIn,
    string? Github,
    string Summary,
    List<WorkEntryDto> WorkEntries,
    List<EducationEntryDto> EducationEntries,
    string TechnicalSkills,
    string SoftSkills,
    string Certifications,
    string Languages,
    string Projects);

public sealed record KeywordMatchDto(List<string> Matched, List<string> Missing);

public sealed record JobMatchSuggestionDto(string Area, string Improvement);

public sealed record JobMatchAnalysisDto(
    string JobTitle,
    string Company,
    int MatchScore,
    string Summary,
    List<string> Strengths,
    List<string> Gaps,
    List<JobMatchSuggestionDto> Suggestions,
    KeywordMatchDto KeywordMatch);

public sealed record CoverLetterFormDataDto(
    string JobTitle,
    string Company,
    string JobDescription,
    string AboutYourself,
    string Tone);

public sealed record SalaryEstimatorFormDataDto(
    string JobTitle,
    string Industry,
    string Experience,
    string Location,
    string Skills,
    string Education);

public sealed record SalaryEstimateDto(
    decimal MinSalary,
    decimal MaxSalary,
    decimal MedianSalary,
    string Currency,
    string? AlternativeCurrency,
    decimal? MinSalaryAlt,
    decimal? MaxSalaryAlt,
    decimal? MedianSalaryAlt,
    string Confidence,
    List<string> Factors,
    string MarketInsights);

public sealed record InterviewQuestionDto(string Category, string Question, string Tip);

public sealed record InterviewCoachFormDataDto(
    string JobTitle,
    string Company,
    string JobDescription,
    string InterviewType,
    string ResumeSummary);

public sealed record InterviewCoachResultDto(
    List<InterviewQuestionDto> Questions,
    List<string> KeyStrengths,
    List<string> CommonPitfalls,
    List<string> ClosingQuestions);

public sealed record CareerCoachFormDataDto(
    string CareerGoal,
    string Timeline,
    List<string> FocusAreas,
    string? AdditionalContext,
    string ResumeSummary,
    string CurrentSkills,
    string ExperienceSummary,
    string? JobMatchGaps,
    string? SalaryInsights);

public sealed record CareerMilestoneDto(string Timeframe, string Goal, List<string> Actions);

public sealed record SkillRecommendationDto(
    string Skill,
    string Priority,
    string Reason,
    List<string> Resources);

public sealed record CareerCoachResultDto(
    List<CareerMilestoneDto> CareerRoadmap,
    List<SkillRecommendationDto> SkillDevelopment,
    List<string> JobSearchStrategy,
    List<string> QuickWins,
    string IndustryOutlook);
