using System.Text.Json;
using DResume.Api.Ai;
using DResume.Api.Contracts;

namespace DResume.Api.Features.Coach;

public interface IInterviewCoachService
{
    Task<(InterviewCoachResultDto Result, string Analysis)> CoachAsync(InterviewCoachFormDataDto form, CancellationToken ct = default);
}

public sealed class InterviewCoachService : IInterviewCoachService
{
    private readonly IAnthropicClient _ai;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    public InterviewCoachService(IAnthropicClient ai) => _ai = ai;

    public async Task<(InterviewCoachResultDto, string)> CoachAsync(InterviewCoachFormDataDto form, CancellationToken ct = default)
    {
        var lang = LanguageDetector.Detect(form.ResumeSummary + " " + form.JobDescription);
        var langInst = LanguageDetector.Instruction(lang);

        var raw1 = await _ai.CompleteAsync(
            PromptLibrary.InterviewCoachSystem1 + "\n" + langInst,
            PromptLibrary.InterviewCoachUser1(form), 2500, ct);
        var result = JsonSerializer.Deserialize<InterviewCoachResultDto>(JsonExtractor.Extract(raw1), JsonOptions)!;

        var analysis = await _ai.CompleteAsync(
            PromptLibrary.InterviewCoachSystem2 + "\n" + langInst,
            PromptLibrary.InterviewCoachUser2(form, result), 1200, ct);

        return (result, analysis);
    }
}
