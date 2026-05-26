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
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public ResumeAnalysisService(IAnthropicClient ai) => _ai = ai;

    public async Task<ResumeAnalysisDto> AnalyzeAsync(string resumeText, CancellationToken ct = default)
    {
        var lang = LanguageDetector.Detect(resumeText);
        var sys = PromptLibrary.AnalyzeSystem + "\n" + LanguageDetector.Instruction(lang);
        var raw = await _ai.CompleteAsync(sys, PromptLibrary.AnalyzeUser(resumeText), 6000, ct);
        var json = JsonExtractor.Extract(raw);
        var result = JsonSerializer.Deserialize<ResumeAnalysisDto>(json, JsonOptions)
            ?? throw new InvalidOperationException("AI returned an empty analysis response.");
        return result;
    }

    public async Task<ResumeFormDataDto> ParseAsync(string resumeText, CancellationToken ct = default)
    {
        var raw = await _ai.CompleteAsync(PromptLibrary.ParseSystem, PromptLibrary.ParseUser(resumeText), 8000, ct);
        return JsonSerializer.Deserialize<ResumeFormDataDto>(JsonExtractor.Extract(raw), JsonOptions)!;
    }
}
