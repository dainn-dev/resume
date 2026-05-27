using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DResume.Api.Ai;
using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using DResume.Api.Features.Build;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/build")]
[Authorize]
public sealed class BuildController : ControllerBase
{
    private readonly IResumeBuildService _service;
    private readonly IAnthropicClient _ai;
    private readonly ResumeDbContext _db;
    private readonly ICurrentUser _current;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public BuildController(IResumeBuildService service, IAnthropicClient ai, ResumeDbContext db, ICurrentUser current)
    {
        _service = service;
        _ai = ai;
        _db = db;
        _current = current;
    }

    [HttpPost]
    public async Task<IActionResult> Build([FromBody] BuildRequest req, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var inputHash = ComputeHash(req.Resume);

        var cached = await _db.ResumeBuilds
            .FirstOrDefaultAsync(b => b.UserId == userId && b.InputHash == inputHash, ct);
        if (cached is not null)
            return Ok(ApiResult.Ok(new BuildResponse(cached.Markdown)));

        var markdown = await _service.BuildAsync(req.Resume, ct);

        _db.ResumeBuilds.Add(new ResumeBuild
        {
            UserId = userId,
            InputHash = inputHash,
            Markdown = markdown,
        });
        await _db.SaveChangesAsync(ct);

        return Ok(ApiResult.Ok(new BuildResponse(markdown)));
    }

    public sealed record ImproveRequest(ResumeFormDataDto Resume, ResumeAnalysisDto Analysis);

    public sealed record ScoreComparison(
        int BeforeOverall, int AfterOverall,
        Dictionary<string, int> BeforeSections, Dictionary<string, int> AfterSections);

    private sealed record ImproveAiResponse(ResumeFormDataDto Resume, Dictionary<string, int> Scores);

    [HttpPost("improve")]
    public async Task<IActionResult> Improve([FromBody] ImproveRequest req, CancellationToken ct)
    {
        var tips = req.Analysis.Sections;
        var allTips = new[] { tips.ContactInfo, tips.Summary, tips.WorkExperience, tips.Education, tips.Skills, tips.Formatting }
            .SelectMany(s => s.Tips.Select(t => $"[{s.Label}] {t.Problem} → {t.Suggestion}"));
        var tipsText = string.Join("\n", allTips);

        var formJson = JsonSerializer.Serialize(req.Resume, JsonOptions);
        var raw = await _ai.CompleteAsync(
            PromptLibrary.ImproveSystem,
            PromptLibrary.ImproveUser(formJson, tipsText),
            8000, ct);

        var aiResult = JsonSerializer.Deserialize<ImproveAiResponse>(JsonExtractor.Extract(raw), JsonOptions)
            ?? throw new InvalidOperationException("AI returned empty improved resume.");

        var beforeSections = new Dictionary<string, int>
        {
            ["contactInfo"] = tips.ContactInfo.Score,
            ["summary"] = tips.Summary.Score,
            ["workExperience"] = tips.WorkExperience.Score,
            ["education"] = tips.Education.Score,
            ["skills"] = tips.Skills.Score,
            ["formatting"] = tips.Formatting.Score,
        };

        var afterSections = aiResult.Scores ?? beforeSections;

        static int WeightedScore(Dictionary<string, int> s) =>
            (int)Math.Round(
                s.GetValueOrDefault("workExperience") * 0.30 +
                s.GetValueOrDefault("skills") * 0.20 +
                s.GetValueOrDefault("summary") * 0.15 +
                s.GetValueOrDefault("formatting") * 0.15 +
                s.GetValueOrDefault("contactInfo") * 0.10 +
                s.GetValueOrDefault("education") * 0.10);

        var comparison = new ScoreComparison(
            req.Analysis.OverallScore, WeightedScore(afterSections),
            beforeSections, afterSections);

        return Ok(ApiResult.Ok(new { resume = aiResult.Resume, comparison }));
    }

    private static string ComputeHash(ResumeFormDataDto data)
    {
        var json = JsonSerializer.Serialize(data, JsonOptions);
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
