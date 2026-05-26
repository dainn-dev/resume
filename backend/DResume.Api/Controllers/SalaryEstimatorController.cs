using System.Text.Json;
using DResume.Api.Billing;
using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using DResume.Api.Features.Salary;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/salary-estimator")]
[Authorize]
[RequiresPlan(PlanCode.Pro)]
public sealed class SalaryEstimatorController : ControllerBase
{
    private readonly ISalaryEstimateService _service;
    private readonly ResumeDbContext _db;
    private readonly ICurrentUser _current;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public SalaryEstimatorController(ISalaryEstimateService service, ResumeDbContext db, ICurrentUser current)
    {
        _service = service;
        _db = db;
        _current = current;
    }

    [HttpPost]
    public async Task<IActionResult> Estimate([FromBody] SalaryEstimatorFormDataDto req, CancellationToken ct)
    {
        var (estimate, analysis) = await _service.EstimateAsync(req, ct);
        var record = new SalaryEstimateRecord
        {
            UserId = _current.RequireUserId(),
            InputJson = JsonSerializer.Serialize(req, JsonOptions),
            EstimateJson = JsonSerializer.Serialize(estimate, JsonOptions),
            Analysis = analysis,
        };
        _db.SalaryEstimates.Add(record);
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new SalaryEstimatorResponse(estimate, analysis, record.Id)));
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var rows = await _db.SalaryEstimates
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
        var row = await _db.SalaryEstimates.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Salary estimate not found.");
        var estimate = JsonSerializer.Deserialize<SalaryEstimateDto>(row.EstimateJson, JsonOptions);
        return Ok(ApiResult.Ok(new { id = row.Id, estimate, analysis = row.Analysis, row.CreatedAt }));
    }
}
