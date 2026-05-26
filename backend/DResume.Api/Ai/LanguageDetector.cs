using System.Text.RegularExpressions;

namespace DResume.Api.Ai;

public static class LanguageDetector
{
    private static readonly Regex VietnamesePattern = new(
        "[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public enum Lang { En, Vi }

    public static Lang Detect(string text)
    {
        if (string.IsNullOrEmpty(text)) return Lang.En;
        var sample = text.Length > 2000 ? text[..2000] : text;
        return VietnamesePattern.Matches(sample).Count >= 3 ? Lang.Vi : Lang.En;
    }

    public static string Instruction(Lang lang) => lang == Lang.Vi
        ? "IMPORTANT: Respond entirely in Vietnamese."
        : "IMPORTANT: Respond entirely in English.";
}
