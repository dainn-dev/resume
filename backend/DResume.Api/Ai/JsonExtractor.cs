using System.Text;
using System.Text.Json;

namespace DResume.Api.Ai;

public static class JsonExtractor
{
    public static string Extract(string raw)
    {
        var start = raw.IndexOf('{');
        if (start == -1) throw new InvalidOperationException("No JSON object found in response.");

        var depth = 0;
        var inString = false;
        var escape = false;

        for (var i = start; i < raw.Length; i++)
        {
            var ch = raw[i];
            if (escape) { escape = false; continue; }
            if (ch == '\\' && inString) { escape = true; continue; }
            if (ch == '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch == '{') depth++;
            else if (ch == '}') { if (--depth == 0) return raw.Substring(start, i - start + 1); }
        }

        var sb = new StringBuilder(raw.Substring(start));
        if (inString) sb.Append('"');
        while (sb.Length > 0 && (sb[^1] == ',' || char.IsWhiteSpace(sb[^1]))) sb.Length--;

        var opens = new Stack<char>();
        var rs = false;
        var re = false;
        foreach (var ch in sb.ToString())
        {
            if (re) { re = false; continue; }
            if (ch == '\\' && rs) { re = true; continue; }
            if (ch == '"') { rs = !rs; continue; }
            if (rs) continue;
            if (ch == '{') opens.Push('}');
            else if (ch == '[') opens.Push(']');
            else if (ch == '}' || ch == ']') { if (opens.Count > 0) opens.Pop(); }
        }
        while (opens.Count > 0) sb.Append(opens.Pop());

        var candidate = sb.ToString();
        try { using var _ = JsonDocument.Parse(candidate); return candidate; }
        catch { throw new InvalidOperationException("Unmatched braces in JSON response."); }
    }
}
