using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DResume.Api.Features.CompanyReview.Sources;

/// <summary>
/// Tolerates Claude AI returning rating as either a number or a string like "4.5", "4.5/5", "4 stars".
/// Falls back to null if parsing fails — better than throwing during deserialization.
/// </summary>
public sealed class FlexibleDoubleConverter : JsonConverter<double?>
{
    public override double? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        switch (reader.TokenType)
        {
            case JsonTokenType.Null:
                return null;
            case JsonTokenType.Number:
                return reader.TryGetDouble(out var n) ? n : null;
            case JsonTokenType.String:
                var s = reader.GetString();
                if (string.IsNullOrWhiteSpace(s)) return null;
                var cleaned = new string(s.Where(c => char.IsDigit(c) || c == '.' || c == ',').ToArray()).Replace(',', '.');
                return double.TryParse(cleaned, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : null;
            default:
                reader.Skip();
                return null;
        }
    }

    public override void Write(Utf8JsonWriter writer, double? value, JsonSerializerOptions options)
    {
        if (value.HasValue) writer.WriteNumberValue(value.Value);
        else writer.WriteNullValue();
    }
}

public sealed class FlexibleIntConverter : JsonConverter<int?>
{
    public override int? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        switch (reader.TokenType)
        {
            case JsonTokenType.Null:
                return null;
            case JsonTokenType.Number:
                return reader.TryGetInt32(out var n) ? n : (reader.TryGetDouble(out var d) ? (int)d : null);
            case JsonTokenType.String:
                var s = reader.GetString();
                if (string.IsNullOrWhiteSpace(s)) return null;
                var cleaned = new string(s.Where(char.IsDigit).ToArray());
                return int.TryParse(cleaned, NumberStyles.Integer, CultureInfo.InvariantCulture, out var i) ? i : null;
            default:
                reader.Skip();
                return null;
        }
    }

    public override void Write(Utf8JsonWriter writer, int? value, JsonSerializerOptions options)
    {
        if (value.HasValue) writer.WriteNumberValue(value.Value);
        else writer.WriteNullValue();
    }
}
