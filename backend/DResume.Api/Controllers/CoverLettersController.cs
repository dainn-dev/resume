using System.Text.Json;
using DResume.Api.Billing;
using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using DResume.Api.Features.CoverLetter;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/cover-letters")]
[Authorize]
[RequiresFeature(Feature.CoverLetter)]
public sealed class CoverLettersController : ControllerBase
{
    private readonly ICoverLetterService _service;
    private readonly ResumeDbContext _db;
    private readonly ICurrentUser _current;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public CoverLettersController(ICoverLetterService service, ResumeDbContext db, ICurrentUser current)
    {
        _service = service;
        _db = db;
        _current = current;
    }

    [HttpPost]
    [ConsumesAiCall]
    public async Task<IActionResult> Create([FromBody] CoverLetterFormDataDto req, CancellationToken ct)
    {
        var text = await _service.GenerateAsync(req, ct);
        var record = new CoverLetter
        {
            UserId = _current.RequireUserId(),
            ResumeId = req.ResumeId,
            JobTitle = req.JobTitle,
            Company = req.Company,
            InputJson = JsonSerializer.Serialize(req, JsonOptions),
            BodyText = text,
        };
        _db.CoverLetters.Add(record);
        await _db.SaveChangesAsync(ct);

        return Ok(ApiResult.Ok(new CoverLetterResponse(text, record.Id)));
    }

    // Decline-offer / reject-candidate email. Gated by the same Cover Letter feature.
    [HttpPost("email")]
    [ConsumesAiCall]
    public async Task<IActionResult> CreateEmail([FromBody] RejectionEmailFormDataDto req, CancellationToken ct)
    {
        var text = await _service.GenerateRejectionAsync(req, ct);
        var record = new CoverLetter
        {
            UserId = _current.RequireUserId(),
            ResumeId = null,
            JobTitle = req.Role,
            Company = req.Company,
            InputJson = JsonSerializer.Serialize(req, JsonOptions),
            BodyText = text,
        };
        _db.CoverLetters.Add(record);
        await _db.SaveChangesAsync(ct);

        return Ok(ApiResult.Ok(new CoverLetterResponse(text, record.Id)));
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var rows = await _db.CoverLetters
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.Id, x.JobTitle, x.Company, x.CreatedAt })
            .ToListAsync(ct);
        return Ok(ApiResult.Ok(rows));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var row = await _db.CoverLetters.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Cover letter not found.");
        return Ok(ApiResult.Ok(new { id = row.Id, jobTitle = row.JobTitle, company = row.Company, text = row.BodyText, row.CreatedAt }));
    }
}

[ApiController]
[Route("api/cover-letter")]
[Authorize]
[RequiresFeature(Feature.CoverLetter)]
public sealed class LegacyCoverLetterController : ControllerBase
{
    private readonly ICoverLetterService _service;
    private readonly ResumeDbContext _db;
    private readonly ICurrentUser _current;
    private static readonly JsonSerializerOptions LegacyJsonOptions = new(JsonSerializerDefaults.Web);

    public LegacyCoverLetterController(ICoverLetterService service, ResumeDbContext db, ICurrentUser current)
    {
        _service = service;
        _db = db;
        _current = current;
    }

    [HttpPost]
    [ConsumesAiCall]
    public async Task<IActionResult> Create([FromBody] CoverLetterFormDataDto req, CancellationToken ct)
    {
        var text = await _service.GenerateAsync(req, ct);
        var record = new CoverLetter
        {
            UserId = _current.RequireUserId(),
            ResumeId = req.ResumeId,
            JobTitle = req.JobTitle,
            Company = req.Company,
            InputJson = JsonSerializer.Serialize(req, LegacyJsonOptions),
            BodyText = text,
        };
        _db.CoverLetters.Add(record);
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new CoverLetterResponse(text, record.Id)));
    }
}
