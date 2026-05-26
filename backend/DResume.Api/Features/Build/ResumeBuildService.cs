using DResume.Api.Ai;
using DResume.Api.Contracts;

namespace DResume.Api.Features.Build;

public interface IResumeBuildService
{
    Task<string> BuildAsync(ResumeFormDataDto data, CancellationToken ct = default);
}

public sealed class ResumeBuildService : IResumeBuildService
{
    private readonly IAnthropicClient _ai;
    public ResumeBuildService(IAnthropicClient ai) => _ai = ai;

    public Task<string> BuildAsync(ResumeFormDataDto data, CancellationToken ct = default)
    {
        var lang = LanguageDetector.Detect(data.Summary + " " + data.TechnicalSkills);
        var sys = PromptLibrary.BuildSystem + "\n" + LanguageDetector.Instruction(lang);
        return _ai.CompleteAsync(sys, PromptLibrary.BuildUser(data), 4000, ct);
    }
}
