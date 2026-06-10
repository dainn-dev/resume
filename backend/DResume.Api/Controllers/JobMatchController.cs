using System.Text.Json;
using DResume.Api.Billing;
using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using DResume.Api.Features.JobMatch;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/job-match")]
[Authorize]
[RequiresFeature(Feature.JobMatch)]
public sealed class JobMatchController : ControllerBase
{
    private readonly IJobMatchService _service;
    private readonly ResumeDbContext _db;
    private readonly ICurrentUser _current;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public JobMatchController(IJobMatchService service, ResumeDbContext db, ICurrentUser current)
    {
        _service = service;
        _db = db;
        _current = current;
    }

    [HttpPost]
    [ConsumesAiCall]
    [EnableRateLimiting("ai")]
    public async Task<IActionResult> Match([FromBody] JobMatchRequest req, CancellationToken ct)
    {
        var (analysis, jd) = await _service.AnalyzeAsync(req.ResumeText, req.JobDescription, req.LinkedinUrl, ct);

        var record = new JobMatchRecord
        {
            UserId = _current.RequireUserId(),
            ResumeId = req.ResumeId,
            JobDescription = jd,
            LinkedInUrl = req.LinkedinUrl,
            MatchScore = analysis.MatchScore,
            ResultJson = JsonSerializer.Serialize(analysis, JsonOptions),
        };
        _db.JobMatches.Add(record);
        await _db.SaveChangesAsync(ct);

        return Ok(ApiResult.Ok(new
        {
            analysis.JobTitle,
            analysis.Company,
            analysis.MatchScore,
            analysis.Summary,
            analysis.Strengths,
            analysis.Gaps,
            analysis.Suggestions,
            analysis.KeywordMatch,
            jobDescription = jd,
            id = record.Id,
        }));
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] Guid? resumeId, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var query = _db.JobMatches
            .Where(x => x.UserId == userId);

        if (resumeId.HasValue)
            query = query.Where(x => x.ResumeId == resumeId.Value);

        var rows = await query
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.Id, x.Title, x.MatchScore, x.CreatedAt, x.ResultJson })
            .ToListAsync(ct);

        var result = rows.Select(x =>
        {
            string? jobTitle = null, company = null;
            try
            {
                var parsed = JsonSerializer.Deserialize<JobMatchAnalysisDto>(x.ResultJson, JsonOptions);
                jobTitle = parsed?.JobTitle;
                company = parsed?.Company;
            }
            catch { /* ignore parse errors */ }
            return new { x.Id, x.Title, x.MatchScore, x.CreatedAt, jobTitle, company };
        });

        return Ok(ApiResult.Ok(result));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var row = await _db.JobMatches.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Job match not found.");
        var analysis = JsonSerializer.Deserialize<JobMatchAnalysisDto>(row.ResultJson, JsonOptions);
        return Ok(ApiResult.Ok(new { id = row.Id, data = analysis, jobDescription = row.JobDescription, row.CreatedAt }));
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Rename(Guid id, [FromBody] JobMatchRenameRequest req, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var row = await _db.JobMatches.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Job match not found.");
        row.Title = req.Title?.Trim();
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new { id = row.Id, title = row.Title }));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var row = await _db.JobMatches.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Job match not found.");
        _db.JobMatches.Remove(row);
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new { deleted = true }));
    }
}
