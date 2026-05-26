using System.Text.Json;
using DResume.Api.Ai;
using DResume.Api.Contracts;

namespace DResume.Api.Features.Salary;

public interface ISalaryEstimateService
{
    Task<(SalaryEstimateDto Estimate, string Analysis)> EstimateAsync(SalaryEstimatorFormDataDto form, CancellationToken ct = default);
}

public sealed class SalaryEstimateService : ISalaryEstimateService
{
    private readonly IAnthropicClient _ai;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    public SalaryEstimateService(IAnthropicClient ai) => _ai = ai;

    public async Task<(SalaryEstimateDto, string)> EstimateAsync(SalaryEstimatorFormDataDto form, CancellationToken ct = default)
    {
        var lang = LanguageDetector.Detect(form.JobTitle + " " + form.Skills + " " + form.Location);
        var langInst = LanguageDetector.Instruction(lang);

        var raw = await _ai.CompleteAsync(
            PromptLibrary.SalarySystem + "\n" + langInst,
            PromptLibrary.SalaryUser(form), 1500, ct);
        var estimate = JsonSerializer.Deserialize<SalaryEstimateDto>(JsonExtractor.Extract(raw), JsonOptions)!;

        var analysis = await _ai.CompleteAsync(
            "You are a helpful career advisor providing actionable salary guidance.\n" + langInst,
            PromptLibrary.SalaryAnalysisUser(form, estimate), 1200, ct);

        return (estimate, analysis);
    }
}
