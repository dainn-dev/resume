using System.Text.Json;
using DResume.Api.Ai;
using DResume.Api.Contracts;

namespace DResume.Api.Features.Coach;

public interface ICareerCoachService
{
    Task<(CareerCoachResultDto Result, string Analysis)> CoachAsync(CareerCoachFormDataDto form, CancellationToken ct = default);
}

public sealed class CareerCoachService : ICareerCoachService
{
    private readonly IAnthropicClient _ai;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    public CareerCoachService(IAnthropicClient ai) => _ai = ai;

    public async Task<(CareerCoachResultDto, string)> CoachAsync(CareerCoachFormDataDto form, CancellationToken ct = default)
    {
        var lang = LanguageDetector.Detect(form.ResumeSummary + " " + form.CareerGoal);
        var langInst = LanguageDetector.Instruction(lang);

        var raw1 = await _ai.CompleteAsync(
            PromptLibrary.CareerCoachSystem1 + "\n" + langInst,
            PromptLibrary.CareerCoachUser1(form), 3000, ct);
        var result = JsonSerializer.Deserialize<CareerCoachResultDto>(JsonExtractor.Extract(raw1), JsonOptions)!;

        var analysis = await _ai.CompleteAsync(
            PromptLibrary.CareerCoachSystem2 + "\n" + langInst,
            PromptLibrary.CareerCoachUser2(form, result), 1200, ct);

        return (result, analysis);
    }
}
