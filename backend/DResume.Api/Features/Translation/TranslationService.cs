using System.Text.Json;
using DResume.Api.Ai;

namespace DResume.Api.Features.Translation;

public interface ITranslationService
{
    Task<object> TranslateAsync(object content, string targetLocale, CancellationToken ct = default);
}

public sealed class TranslationService : ITranslationService
{
    private readonly IAnthropicClient _ai;
    public TranslationService(IAnthropicClient ai) => _ai = ai;

    public async Task<object> TranslateAsync(object content, string targetLocale, CancellationToken ct = default)
    {
        if (targetLocale == "en") return content;

        var localeName = targetLocale == "vi" ? "Vietnamese" : targetLocale;
        var isPlainText = content is string;
        var contentStr = content is string s ? s : JsonSerializer.Serialize(content);

        var userPrompt = isPlainText
            ? $"Translate the following text to {localeName}. Return ONLY the translated text, no JSON wrapping, no quotes, no explanation.\n\n{contentStr}"
            : $"Translate all string values in this JSON to {localeName}. Return ONLY the translated JSON.\n\n{contentStr}";

        var raw = await _ai.CompleteAsync(PromptLibrary.TranslateSystem, userPrompt, 4000, ct);

        if (isPlainText) return raw.Trim();

        var cleaned = raw.Trim();
        if (cleaned.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            cleaned = cleaned[7..].TrimStart();
        if (cleaned.EndsWith("```"))
            cleaned = cleaned[..^3].TrimEnd();

        using var doc = JsonDocument.Parse(cleaned);
        return JsonSerializer.Deserialize<object>(doc.RootElement.GetRawText())!;
    }
}
