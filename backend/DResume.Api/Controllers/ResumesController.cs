using System.Security.Cryptography;
using System.Text.Json;
using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using DResume.Api.DocumentParsing;
using DResume.Api.Features.Resumes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/resumes")]
[Authorize]
public sealed class ResumesController : ControllerBase
{
    private readonly ResumeDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IResumeAnalysisService _analysis;
    private readonly IDocumentParser _parser;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public ResumesController(ResumeDbContext db, ICurrentUser current, IResumeAnalysisService analysis, IDocumentParser parser)
    {
        _db = db;
        _current = current;
        _analysis = analysis;
        _parser = parser;
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var rows = await _db.Resumes
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.UpdatedAt)
            .Select(r => new
            {
                r.Id,
                r.Title,
                r.SourceFileName,
                LastScore = _db.ResumeAnalyses
                    .Where(a => a.ResumeId == r.Id)
                    .OrderByDescending(a => a.CreatedAt)
                    .Select(a => (int?)a.Score)
                    .FirstOrDefault(),
                r.CreatedAt,
                r.UpdatedAt
            })
            .ToListAsync(ct);

        var items = rows.Select(r => new ResumeListItem(r.Id, r.Title, r.SourceFileName, r.LastScore, r.CreatedAt, r.UpdatedAt));
        return Ok(ApiResult.Ok(items));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var resume = await _db.Resumes.FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Resume not found.");
        var latest = await _db.ResumeAnalyses
            .Where(a => a.ResumeId == id)
            .OrderByDescending(a => a.CreatedAt)
            .FirstOrDefaultAsync(ct);

        var parsed = string.IsNullOrEmpty(resume.ParsedDataJson) ? null
            : JsonSerializer.Deserialize<ResumeFormDataDto>(resume.ParsedDataJson, JsonOptions);
        var analysis = latest is null ? null
            : JsonSerializer.Deserialize<ResumeAnalysisDto>(latest.ResultJson, JsonOptions);

        return Ok(ApiResult.Ok(new ResumeDetail(resume.Id, resume.Title, resume.SourceFileName, resume.RawText, parsed, analysis, resume.CreatedAt, resume.UpdatedAt)));
    }

    [HttpPost]
    [RequestSizeLimit(15 * 1024 * 1024)]
    public async Task<IActionResult> Upload(IFormFile file, [FromForm] string? title, CancellationToken ct)
    {
        if (file is null || file.Length == 0) throw new ArgumentException("File is required.");
        var userId = _current.RequireUserId();

        var fileHash = await ComputeFileHashAsync(file, ct);
        var existing = await FindByHashAsync(userId, fileHash, ct);
        if (existing is not null) return Ok(ApiResult.Ok(existing));

        await using var stream = file.OpenReadStream();
        var text = await _parser.ExtractAsync(stream, file.ContentType, file.FileName, ct);
        if (string.IsNullOrWhiteSpace(text)) throw new ArgumentException("Could not extract text from file.");

        var parsed = await _analysis.ParseAsync(text, ct);
        var analysis = await _analysis.AnalyzeAsync(text, ct);

        var resume = new Resume
        {
            UserId = userId,
            Title = title ?? parsed.FullName ?? file.FileName,
            SourceFileName = file.FileName,
            RawText = text,
            ParsedDataJson = JsonSerializer.Serialize(parsed, JsonOptions),
            FileHash = fileHash,
        };
        _db.Resumes.Add(resume);

        var record = new ResumeAnalysisRecord
        {
            UserId = userId,
            ResumeId = resume.Id,
            Score = analysis.OverallScore,
            ResultJson = JsonSerializer.Serialize(analysis, JsonOptions),
        };
        _db.ResumeAnalyses.Add(record);
        resume.LastAnalysisId = record.Id;

        await _db.SaveChangesAsync(ct);

        return Ok(ApiResult.Ok(new CreateResumeResponse(resume.Id, resume.Title, text, parsed, analysis, record.Id)));
    }

    [HttpPost("parse")]
    public async Task<IActionResult> ParseText([FromBody] ParseResumeRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.ResumeText)) throw new ArgumentException("resumeText is required.");
        var parsed = await _analysis.ParseAsync(req.ResumeText, ct);
        return Ok(ApiResult.Ok(parsed));
    }

    [HttpPost("{id:guid}/analyze")]
    public async Task<IActionResult> AnalyzeExisting(Guid id, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var resume = await _db.Resumes.FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Resume not found.");

        var analysis = await _analysis.AnalyzeAsync(resume.RawText, ct);
        var record = new ResumeAnalysisRecord
        {
            UserId = userId,
            ResumeId = resume.Id,
            Score = analysis.OverallScore,
            ResultJson = JsonSerializer.Serialize(analysis, JsonOptions),
        };
        _db.ResumeAnalyses.Add(record);
        resume.LastAnalysisId = record.Id;
        resume.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(ApiResult.Ok(analysis));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var resume = await _db.Resumes.FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Resume not found.");

        _db.JobMatches.RemoveRange(_db.JobMatches.Where(x => x.ResumeId == id));
        _db.CoverLetters.RemoveRange(_db.CoverLetters.Where(x => x.ResumeId == id));
        _db.Resumes.Remove(resume);
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResult.Ok(new { deleted = true }));
    }

    private static async Task<string> ComputeFileHashAsync(IFormFile file, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        var hash = await SHA256.HashDataAsync(stream, ct);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private async Task<CreateResumeResponse?> FindByHashAsync(Guid userId, string fileHash, CancellationToken ct)
    {
        var resume = await _db.Resumes
            .FirstOrDefaultAsync(r => r.UserId == userId && r.FileHash == fileHash, ct);
        if (resume is null) return null;

        var latest = await _db.ResumeAnalyses
            .Where(a => a.ResumeId == resume.Id)
            .OrderByDescending(a => a.CreatedAt)
            .FirstOrDefaultAsync(ct);

        var parsed = string.IsNullOrEmpty(resume.ParsedDataJson) ? null
            : JsonSerializer.Deserialize<ResumeFormDataDto>(resume.ParsedDataJson, JsonOptions);
        var analysis = latest is null ? null
            : JsonSerializer.Deserialize<ResumeAnalysisDto>(latest.ResultJson, JsonOptions);

        resume.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return new CreateResumeResponse(resume.Id, resume.Title, resume.RawText, parsed, analysis, latest?.Id);
    }
}

[ApiController]
[Route("api/analyze")]
[Authorize]
public sealed class LegacyAnalyzeController : ControllerBase
{
    private readonly ResumeDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IResumeAnalysisService _analysis;
    private readonly IDocumentParser _parser;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public LegacyAnalyzeController(ResumeDbContext db, ICurrentUser current, IResumeAnalysisService analysis, IDocumentParser parser)
    {
        _db = db;
        _current = current;
        _analysis = analysis;
        _parser = parser;
    }

    [HttpPost]
    [RequestSizeLimit(15 * 1024 * 1024)]
    public async Task<IActionResult> Upload(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) throw new ArgumentException("File is required.");
        var userId = _current.RequireUserId();

        var fileHash = await ComputeFileHashAsync(file, ct);
        var existing = await _db.Resumes
            .FirstOrDefaultAsync(r => r.UserId == userId && r.FileHash == fileHash, ct);
        if (existing is not null)
        {
            var latestAnalysis = await _db.ResumeAnalyses
                .Where(a => a.ResumeId == existing.Id)
                .OrderByDescending(a => a.CreatedAt)
                .FirstOrDefaultAsync(ct);

            var cachedAnalysis = latestAnalysis is null ? null
                : JsonSerializer.Deserialize<ResumeAnalysisDto>(latestAnalysis.ResultJson, JsonOptions);

            existing.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            return Ok(new
            {
                success = true,
                data = cachedAnalysis,
                resumeText = existing.RawText,
                id = existing.Id,
                error = (string?)null,
            });
        }

        await using var stream = file.OpenReadStream();
        var text = await _parser.ExtractAsync(stream, file.ContentType, file.FileName, ct);
        if (string.IsNullOrWhiteSpace(text)) throw new ArgumentException("Could not extract text from file.");

        var parsed = await _analysis.ParseAsync(text, ct);
        var analysis = await _analysis.AnalyzeAsync(text, ct);

        var resume = new Resume
        {
            UserId = userId,
            Title = parsed.FullName ?? file.FileName,
            SourceFileName = file.FileName,
            RawText = text,
            ParsedDataJson = JsonSerializer.Serialize(parsed, JsonOptions),
            FileHash = fileHash,
        };
        _db.Resumes.Add(resume);
        var record = new ResumeAnalysisRecord
        {
            UserId = userId,
            ResumeId = resume.Id,
            Score = analysis.OverallScore,
            ResultJson = JsonSerializer.Serialize(analysis, JsonOptions),
        };
        _db.ResumeAnalyses.Add(record);
        resume.LastAnalysisId = record.Id;
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            success = true,
            data = analysis,
            resumeText = text,
            id = resume.Id,
            error = (string?)null,
        });
    }

    private static async Task<string> ComputeFileHashAsync(IFormFile file, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        var hash = await SHA256.HashDataAsync(stream, ct);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}

[ApiController]
[Route("api/parse-resume")]
[Authorize]
public sealed class LegacyParseController : ControllerBase
{
    private readonly IResumeAnalysisService _analysis;
    public LegacyParseController(IResumeAnalysisService analysis) => _analysis = analysis;

    [HttpPost]
    public async Task<IActionResult> Parse([FromBody] ParseResumeRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.ResumeText)) throw new ArgumentException("resumeText is required.");
        var parsed = await _analysis.ParseAsync(req.ResumeText, ct);
        return Ok(ApiResult.Ok(parsed));
    }
}
