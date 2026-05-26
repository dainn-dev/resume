namespace DResume.Api.Ai;

public sealed class AnthropicOptions
{
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.anthropic.com";
    public string Model { get; set; } = "claude-sonnet-4-6";
    public string ApiVersion { get; set; } = "2023-06-01";
    public int TimeoutSeconds { get; set; } = 120;
}
