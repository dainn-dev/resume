using System.Text;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using UglyToad.PdfPig;

namespace DResume.Api.DocumentParsing;

public interface IDocumentParser
{
    Task<string> ExtractAsync(Stream stream, string contentType, string fileName, CancellationToken ct = default);
}

public sealed class DocumentParser : IDocumentParser
{
    public async Task<string> ExtractAsync(Stream stream, string contentType, string fileName, CancellationToken ct = default)
    {
        var ext = Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant();

        if (contentType == "application/pdf" || ext == "pdf")
            return Sanitize(ExtractPdf(stream));

        if (contentType == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || ext == "docx")
            return Sanitize(ExtractDocx(stream));

        if (contentType == "text/plain" || ext == "txt")
        {
            using var reader = new StreamReader(stream, Encoding.UTF8, leaveOpen: false);
            return Sanitize(await reader.ReadToEndAsync(ct));
        }

        throw new ArgumentException("Unsupported file type. Please upload PDF, DOCX, or TXT.");
    }

    // Strip NUL (0x00) and other C0 control chars (keep tab/newline/carriage return).
    // PostgreSQL text/jsonb columns reject 0x00 ("invalid byte sequence for encoding UTF8"),
    // and such chars also break JSON parsing of AI responses downstream.
    private static string Sanitize(string text)
    {
        if (string.IsNullOrEmpty(text)) return text;
        var sb = new StringBuilder(text.Length);
        foreach (var c in text)
        {
            if (c == '\t' || c == '\n' || c == '\r' || !char.IsControl(c))
                sb.Append(c);
        }
        return sb.ToString();
    }

    private static string ExtractPdf(Stream stream)
    {
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        ms.Position = 0;
        using var doc = PdfDocument.Open(ms);
        var sb = new StringBuilder();
        foreach (var page in doc.GetPages())
            sb.AppendLine(page.Text);
        return sb.ToString();
    }

    private static string ExtractDocx(Stream stream)
    {
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        ms.Position = 0;
        using var doc = WordprocessingDocument.Open(ms, false);
        var body = doc.MainDocumentPart?.Document?.Body;
        if (body is null) return string.Empty;
        var sb = new StringBuilder();
        foreach (var para in body.Descendants<Paragraph>())
            sb.AppendLine(para.InnerText);
        return sb.ToString();
    }
}
