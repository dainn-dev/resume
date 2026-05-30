using System.Text.Json;
using DResume.Api.Ai;
using DResume.Api.Common;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/admin/ai-providers")]
[Authorize]
[RequiresAdmin]
public sealed class AdminAiProvidersController : ControllerBase
{
    private readonly ResumeDbContext _db;
    private readonly IAiProviderService _providerService;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public AdminAiProvidersController(ResumeDbContext db, IAiProviderService providerService)
    {
        _db = db;
        _providerService = providerService;
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var rows = await _db.AiProviders
            .OrderBy(p => p.Priority).ThenBy(p => p.Name)
            .AsNoTracking()
            .ToListAsync(ct);

        var result = rows.Select(p => new
        {
            p.Id,
            p.Name,
            p.BaseUrl,
            apiKeyPreview = MaskKey(p.ApiKey),
            models = ParseModels(p.ModelsJson),
            p.IsEnabled,
            p.RoundRobin,
            p.Priority,
            p.CreatedAt,
            p.UpdatedAt,
        });

        return Ok(ApiResult.Ok(result));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] AiProviderRequest req, CancellationToken ct)
    {
        var entity = new AiProvider
        {
            Name = req.Name.Trim(),
            BaseUrl = req.BaseUrl.Trim(),
            ApiKey = req.ApiKey.Trim(),
            ModelsJson = JsonSerializer.Serialize(req.Models ?? [], JsonOpts),
            IsEnabled = req.IsEnabled,
            RoundRobin = req.RoundRobin,
            Priority = req.Priority,
        };
        _db.AiProviders.Add(entity);
        await _db.SaveChangesAsync(ct);
        _providerService.InvalidateCache();

        return Ok(ApiResult.Ok(new { entity.Id }));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] AiProviderRequest req, CancellationToken ct)
    {
        var entity = await _db.AiProviders.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new KeyNotFoundException("AI provider not found.");

        entity.Name = req.Name.Trim();
        entity.BaseUrl = req.BaseUrl.Trim();
        if (!string.IsNullOrWhiteSpace(req.ApiKey) && req.ApiKey != MaskKey(entity.ApiKey))
            entity.ApiKey = req.ApiKey.Trim();
        entity.ModelsJson = JsonSerializer.Serialize(req.Models ?? [], JsonOpts);
        entity.IsEnabled = req.IsEnabled;
        entity.RoundRobin = req.RoundRobin;
        entity.Priority = req.Priority;
        entity.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        _providerService.InvalidateCache();

        return Ok(ApiResult.Ok(new { updated = true }));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var entity = await _db.AiProviders.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new KeyNotFoundException("AI provider not found.");

        _db.AiProviders.Remove(entity);
        await _db.SaveChangesAsync(ct);
        _providerService.InvalidateCache();

        return Ok(ApiResult.Ok(new { deleted = true }));
    }

    private static string MaskKey(string key)
    {
        if (string.IsNullOrEmpty(key) || key.Length <= 8) return "••••••••";
        return key[..4] + "••••" + key[^4..];
    }

    private static List<string> ParseModels(string json)
    {
        try { return JsonSerializer.Deserialize<List<string>>(json, JsonOpts) ?? []; }
        catch { return []; }
    }
}

public sealed record AiProviderRequest(
    string Name,
    string BaseUrl,
    string ApiKey,
    List<string>? Models,
    bool IsEnabled,
    bool RoundRobin,
    int Priority);
