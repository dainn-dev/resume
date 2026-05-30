using System.Text.Json;
using DResume.Api.Billing;
using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using DResume.Api.Features.Coach;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/interview-coach")]
[Authorize]
[RequiresFeature(Feature.InterviewCoach)]
public sealed class InterviewCoachController : ControllerBase
{
    private readonly IInterviewCoachService _service;
    private readonly ResumeDbContext _db;
    private readonly ICurrentUser _current;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public InterviewCoachController(IInterviewCoachService service, ResumeDbContext db, ICurrentUser current)
    {
        _service = service;
        _db = db;
        _current = current;
    }

    [HttpPost]
    [ConsumesAiCall]
    public async Task<IActionResult> Coach([FromBody] InterviewCoachFormDataDto req, CancellationToken ct)
    {
        var (result, analysis) = await _service.CoachAsync(req, ct);
        var record = new InterviewCoachSession
        {
            UserId = _current.RequireUserId(),
            InputJson = JsonSerializer.Serialize(req, JsonOptions),
            ResultJson = JsonSerializer.Serialize(result, JsonOptions),
            Analysis = analysis,
        };
        _db.InterviewCoachSessions.Add(record);
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new InterviewCoachResponse(result, analysis, record.Id)));
    }

    [HttpPost("more")]
    [ConsumesAiCall]
    public async Task<IActionResult> MoreQuestions([FromBody] InterviewCoachMoreRequest req, CancellationToken ct)
    {
        var form = new InterviewCoachFormDataDto(req.JobTitle, req.Company, req.JobDescription, req.InterviewType, req.ResumeSummary);
        var questions = await _service.MoreQuestionsAsync(form, req.ExistingQuestions, ct);
        return Ok(ApiResult.Ok(new { questions }));
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var rows = await _db.InterviewCoachSessions
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.Id, x.CreatedAt })
            .ToListAsync(ct);
        return Ok(ApiResult.Ok(rows));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var row = await _db.InterviewCoachSessions.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Interview coach session not found.");
        var result = JsonSerializer.Deserialize<InterviewCoachResultDto>(row.ResultJson, JsonOptions);
        return Ok(ApiResult.Ok(new { id = row.Id, result, analysis = row.Analysis, row.CreatedAt }));
    }
}
