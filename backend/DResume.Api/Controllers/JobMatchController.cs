using System.Text.Json;
using DResume.Api.Billing;
using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using DResume.Api.Features.JobMatch;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/job-match")]
[Authorize]
[RequiresPlan(PlanCode.Pro)]
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
    public async Task<IActionResult> Match([FromBody] JobMatchRequest req, CancellationToken ct)
    {
        var (analysis, jd) = await _service.AnalyzeAsync(req.ResumeText, req.JobDescription, req.LinkedinUrl, ct);

        var record = new JobMatchRecord
        {
            UserId = _current.RequireUserId(),
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
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var rows = await _db.JobMatches
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.Id, x.MatchScore, x.CreatedAt })
            .ToListAsync(ct);
        return Ok(ApiResult.Ok(rows));
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
}
