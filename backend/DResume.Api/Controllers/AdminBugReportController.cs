using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/admin/bug-reports")]
[Authorize]
[RequiresAdmin]
public sealed class AdminBugReportController : ControllerBase
{
    private readonly ResumeDbContext _db;

    public AdminBugReportController(ResumeDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int size = 20,
        [FromQuery] string? status = null,
        [FromQuery] string? severity = null,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        size = Math.Clamp(size, 1, 100);

        var query = _db.BugReports.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<BugReportStatus>(status, true, out var st))
            query = query.Where(r => r.Status == st);
        if (!string.IsNullOrWhiteSpace(severity) && Enum.TryParse<BugSeverity>(severity, true, out var sev))
            query = query.Where(r => r.Severity == sev);

        var total = await query.CountAsync(ct);
        var newCount = await _db.BugReports.AsNoTracking().CountAsync(r => r.Status == BugReportStatus.New, ct);

        var rows = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * size)
            .Take(size)
            .ToListAsync(ct);

        return Ok(ApiResult.Ok(new BugReportListResponse
        {
            Total = total,
            Page = page,
            Size = size,
            NewCount = newCount,
            Reports = rows.Select(BugReportDto.From).ToList(),
        }));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var report = await _db.BugReports.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct);
        if (report is null) return NotFound(ApiResult.Fail("Bug report not found."));
        return Ok(ApiResult.Ok(BugReportDto.From(report)));
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBugReportRequest req, CancellationToken ct)
    {
        var report = await _db.BugReports.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (report is null) return NotFound(ApiResult.Fail("Bug report not found."));

        if (req.Status is { } status)
        {
            if (!Enum.IsDefined(typeof(BugReportStatus), status))
                return BadRequest(ApiResult.Fail("Invalid status."));
            report.Status = status;
        }

        if (req.AdminNotes is not null)
            report.AdminNotes = string.IsNullOrWhiteSpace(req.AdminNotes) ? null : req.AdminNotes.Trim();

        report.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(ApiResult.Ok(BugReportDto.From(report)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var report = await _db.BugReports.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (report is null) return NotFound(ApiResult.Fail("Bug report not found."));

        _db.BugReports.Remove(report);
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new { deleted = true }));
    }
}
