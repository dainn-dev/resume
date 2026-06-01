using DResume.Api.Ai;
using DResume.Api.Contracts;

namespace DResume.Api.Features.CoverLetter;

public interface ICoverLetterService
{
    Task<string> GenerateAsync(CoverLetterFormDataDto data, CancellationToken ct = default);
    Task<string> GenerateRejectionAsync(RejectionEmailFormDataDto data, CancellationToken ct = default);
}

public sealed class CoverLetterService : ICoverLetterService
{
    private readonly IAnthropicClient _ai;
    public CoverLetterService(IAnthropicClient ai) => _ai = ai;

    public Task<string> GenerateAsync(CoverLetterFormDataDto data, CancellationToken ct = default)
    {
        var lang = LanguageDetector.Detect(data.AboutYourself + " " + data.JobDescription);
        var sys = PromptLibrary.CoverLetterSystem(data.Tone) + "\n" + LanguageDetector.Instruction(lang);
        return _ai.CompleteAsync(sys, PromptLibrary.CoverLetterUser(data), 1000, ct);
    }

    public Task<string> GenerateRejectionAsync(RejectionEmailFormDataDto data, CancellationToken ct = default)
    {
        var lang = LanguageDetector.Detect($"{data.Reason} {data.Role} {data.Company} {data.RecipientName} {data.SenderName}");
        var sys = PromptLibrary.RejectionEmailSystem(data.Type, data.Tone) + "\n" + LanguageDetector.Instruction(lang);
        return _ai.CompleteAsync(sys, PromptLibrary.RejectionEmailUser(data), 700, ct);
    }
}
