using System.Text.Json;
using DResume.Api.Ai;
using DResume.Api.Contracts;

namespace DResume.Api.Features.Resumes;

public interface IResumeAnalysisService
{
    Task<ResumeAnalysisDto> AnalyzeAsync(string resumeText, CancellationToken ct = default);
    Task<ResumeFormDataDto> ParseAsync(string resumeText, CancellationToken ct = default);
}

public sealed class ResumeAnalysisService : IResumeAnalysisService
{
    private readonly IAnthropicClient _ai;
    private readonly ILogger<ResumeAnalysisService> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public ResumeAnalysisService(IAnthropicClient ai, ILogger<ResumeAnalysisService> logger)
    {
        _ai = ai;
        _logger = logger;
    }

    public async Task<ResumeAnalysisDto> AnalyzeAsync(string resumeText, CancellationToken ct = default)
    {
        var lang = LanguageDetector.Detect(resumeText);
        var langInstruction = LanguageDetector.Instruction(lang);
        var sys = PromptLibrary.AnalyzeSectionSystem + "\n" + langInstruction;

        var semaphore = new SemaphoreSlim(2);
        var tasks = PromptLibrary.AnalyzeSections.Select(async s =>
        {
            await semaphore.WaitAsync(ct);
            try { return await AnalyzeSectionAsync(sys, resumeText, s.Key, s.Label, ct); }
            finally { semaphore.Release(); }
        });
        var results = await Task.WhenAll(tasks);

        var sectionMap = results.ToDictionary(r => r.Key, r => r.Analysis);
        var scoreMap = results.ToDictionary(r => r.Key, r => r.Analysis.Score);

        var summarySys = PromptLibrary.AnalyzeSummarySystem + "\n" + langInstruction;
        var summaryRaw = await _ai.CompleteAsync(summarySys, PromptLibrary.AnalyzeSummaryUser(scoreMap), 500, ct);
        var summaryJson = JsonExtractor.Extract(summaryRaw);
        var summary = JsonSerializer.Deserialize<OverallSummaryDto>(summaryJson, JsonOptions)
            ?? new OverallSummaryDto(0, "Analysis completed.");

        return new ResumeAnalysisDto(
            summary.OverallScore,
            summary.OverallSummary,
            new ResumeSections(
                sectionMap.GetValueOrDefault("contactInfo") ?? EmptySection("Contact Information"),
                sectionMap.GetValueOrDefault("summary") ?? EmptySection("Summary / Objective"),
                sectionMap.GetValueOrDefault("workExperience") ?? EmptySection("Work Experience"),
                sectionMap.GetValueOrDefault("education") ?? EmptySection("Education"),
                sectionMap.GetValueOrDefault("skills") ?? EmptySection("Skills"),
                sectionMap.GetValueOrDefault("formatting") ?? EmptySection("Formatting & Readability")
            ));
    }

    private async Task<(string Key, SectionAnalysis Analysis)> AnalyzeSectionAsync(
        string systemPrompt, string resumeText, string key, string label, CancellationToken ct)
    {
        try
        {
            var raw = await _ai.CompleteAsync(
                systemPrompt,
                PromptLibrary.AnalyzeSectionUser(resumeText, key, label),
                800, ct);
            var json = JsonExtractor.Extract(raw);
            var result = JsonSerializer.Deserialize<SectionAnalysis>(json, JsonOptions)
                ?? EmptySection(label);
            return (key, result);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to analyze section {Section}, using fallback", key);
            return (key, EmptySection(label));
        }
    }

    private static SectionAnalysis EmptySection(string label) =>
        new(0, label, [new Tip("Section could not be analyzed", "Please try again")]);

    public async Task<ResumeFormDataDto> ParseAsync(string resumeText, CancellationToken ct = default)
    {
        var raw = await _ai.CompleteAsync(PromptLibrary.ParseSystem, PromptLibrary.ParseUser(resumeText), 8000, ct);
        return JsonSerializer.Deserialize<ResumeFormDataDto>(JsonExtractor.Extract(raw), JsonOptions)!;
    }
}

internal sealed record OverallSummaryDto(int OverallScore, string OverallSummary);
