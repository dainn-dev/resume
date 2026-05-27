using System.Text.Json;
using DResume.Api.Ai;
using DResume.Api.Contracts;

namespace DResume.Api.Features.Calendar;

public interface ITaskGeneratorService
{
    Task<List<GeneratedTaskDto>> GenerateAsync(
        string goalTitle, string milestoneTitle, string startDate, string endDate, string? context,
        CancellationToken ct = default);
}

public sealed class TaskGeneratorService : ITaskGeneratorService
{
    private readonly IAnthropicClient _ai;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public TaskGeneratorService(IAnthropicClient ai) => _ai = ai;

    public async Task<List<GeneratedTaskDto>> GenerateAsync(
        string goalTitle, string milestoneTitle, string startDate, string endDate, string? context,
        CancellationToken ct = default)
    {
        var allText = $"{goalTitle} {milestoneTitle} {context}";
        var lang = LanguageDetector.Detect(allText);
        var langInst = LanguageDetector.Instruction(lang);

        var raw = await _ai.CompleteAsync(
            PromptLibrary.GenerateTasksSystem + "\n" + langInst,
            PromptLibrary.GenerateTasksUser(goalTitle, milestoneTitle, startDate, endDate, context),
            4000, ct);

        var wrapper = JsonSerializer.Deserialize<GenerateTasksAiResponse>(JsonExtractor.Extract(raw), JsonOptions)!;
        return wrapper.Tasks;
    }
}
