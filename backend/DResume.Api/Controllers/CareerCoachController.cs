using System.Text.Json;
using DResume.Api.Billing;
using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using DResume.Api.Features.Coach;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/career-coach")]
[Authorize]
[RequiresFeature(Feature.CareerCoach)]
public sealed class CareerCoachController : ControllerBase
{
    private readonly ICareerCoachService _service;
    private readonly ResumeDbContext _db;
    private readonly ICurrentUser _current;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public CareerCoachController(ICareerCoachService service, ResumeDbContext db, ICurrentUser current)
    {
        _service = service;
        _db = db;
        _current = current;
    }

    [HttpPost]
    [ConsumesAiCall]
    [EnableRateLimiting("ai")]
    public async Task<IActionResult> Coach([FromBody] CareerCoachFormDataDto req, CancellationToken ct)
    {
        var (result, analysis) = await _service.CoachAsync(req, ct);
        var record = new CareerCoachSession
        {
            UserId = _current.RequireUserId(),
            InputJson = JsonSerializer.Serialize(req, JsonOptions),
            ResultJson = JsonSerializer.Serialize(result, JsonOptions),
            Analysis = analysis,
        };
        _db.CareerCoachSessions.Add(record);
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new CareerCoachResponse(result, analysis, record.Id)));
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var rows = await _db.CareerCoachSessions
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
        var row = await _db.CareerCoachSessions.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Career coach session not found.");
        var result = JsonSerializer.Deserialize<CareerCoachResultDto>(row.ResultJson, JsonOptions);
        return Ok(ApiResult.Ok(new { id = row.Id, result, analysis = row.Analysis, row.CreatedAt }));
    }
}
