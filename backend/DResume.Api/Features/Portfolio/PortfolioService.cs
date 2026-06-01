using System.Text.Json;
using System.Text.RegularExpressions;
using DResume.Api.Contracts;
using DResume.Api.Data;
using DResume.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DResume.Api.Features.Portfolio;

public interface IPortfolioService
{
    Task<PortfolioDto?> GetMineAsync(Guid userId, CancellationToken ct = default);
    Task<SubdomainAvailabilityDto> CheckAvailabilityAsync(string subdomain, Guid excludeUserId, CancellationToken ct = default);
    Task<PortfolioDto> CreateAsync(Guid userId, CreatePortfolioRequest req, CancellationToken ct = default);
    Task<PortfolioDto> UpdateAsync(Guid userId, UpdatePortfolioRequest req, CancellationToken ct = default);
    Task DeleteAsync(Guid userId, CancellationToken ct = default);
    Task<PublicPortfolioDto?> GetPublicAsync(string subdomain, CancellationToken ct = default);

    // Admin
    Task<List<AdminPortfolioDto>> ListForAdminAsync(PortfolioStatus? status, CancellationToken ct = default);
    Task ApproveAsync(Guid siteId, string adminEmail, CancellationToken ct = default);
    Task RejectAsync(Guid siteId, string adminEmail, string reason, CancellationToken ct = default);
}

public sealed class PortfolioService : IPortfolioService
{
    private readonly ResumeDbContext _db;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    // 3–63 chars, lowercase alphanumeric + hyphen, no leading/trailing hyphen.
    private static readonly Regex SubdomainRegex = new("^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$", RegexOptions.Compiled);

    private static readonly HashSet<string> ReservedSubdomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "www", "api", "app", "admin", "mail", "smtp", "ftp", "ns1", "ns2", "cdn", "static",
        "assets", "blog", "help", "support", "status", "dashboard", "login", "register",
        "billing", "open-api", "open-claude", "dainn", "portfolio", "test", "dev", "staging",
    };

    private static readonly HashSet<string> AllowedThemes = new(StringComparer.OrdinalIgnoreCase)
    {
        "minimal", "modern", "classic",
    };

    public PortfolioService(ResumeDbContext db) => _db = db;

    private static string NormalizeAndValidateSubdomain(string raw)
    {
        var sub = (raw ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(sub))
            throw new ArgumentException("Subdomain is required.");
        if (!SubdomainRegex.IsMatch(sub))
            throw new ArgumentException("Subdomain must be 3–63 characters, lowercase letters/numbers/hyphens, and cannot start or end with a hyphen.");
        if (ReservedSubdomains.Contains(sub))
            throw new ArgumentException($"'{sub}' is a reserved name and cannot be used.");
        return sub;
    }

    private static string NormalizeTheme(string? theme)
    {
        var t = (theme ?? "minimal").Trim().ToLowerInvariant();
        if (!AllowedThemes.Contains(t))
            throw new ArgumentException($"Unknown theme '{t}'. Choose one of: {string.Join(", ", AllowedThemes)}.");
        return t;
    }

    private async Task EnsureResumeOwnedAsync(Guid userId, Guid resumeId, CancellationToken ct)
    {
        var owned = await _db.Resumes.AnyAsync(r => r.Id == resumeId && r.UserId == userId, ct);
        if (!owned) throw new ArgumentException("Selected resume was not found.");
    }

    private async Task<string?> ResumeTitleAsync(Guid resumeId, CancellationToken ct) =>
        await _db.Resumes.Where(r => r.Id == resumeId).Select(r => r.Title).FirstOrDefaultAsync(ct);

    private async Task<PortfolioDto> ToDtoAsync(PortfolioSite s, CancellationToken ct) =>
        new(s.Id, s.Subdomain, s.ResumeId, await ResumeTitleAsync(s.ResumeId, ct),
            s.Theme, s.Status.ToString(), s.HideContact, s.RejectReason, s.CreatedAt, s.UpdatedAt);

    public async Task<PortfolioDto?> GetMineAsync(Guid userId, CancellationToken ct = default)
    {
        var site = await _db.PortfolioSites.FirstOrDefaultAsync(p => p.UserId == userId, ct);
        return site is null ? null : await ToDtoAsync(site, ct);
    }

    public async Task<SubdomainAvailabilityDto> CheckAvailabilityAsync(string subdomain, Guid excludeUserId, CancellationToken ct = default)
    {
        string sub;
        try { sub = NormalizeAndValidateSubdomain(subdomain); }
        catch (ArgumentException ex) { return new SubdomainAvailabilityDto(false, ex.Message); }

        var taken = await _db.PortfolioSites.AnyAsync(p => p.Subdomain == sub && p.UserId != excludeUserId, ct);
        return taken
            ? new SubdomainAvailabilityDto(false, "This subdomain is already taken.")
            : new SubdomainAvailabilityDto(true, null);
    }

    public async Task<PortfolioDto> CreateAsync(Guid userId, CreatePortfolioRequest req, CancellationToken ct = default)
    {
        if (await _db.PortfolioSites.AnyAsync(p => p.UserId == userId, ct))
            throw new ArgumentException("You already have a portfolio. Edit it instead of creating a new one.");

        var sub = NormalizeAndValidateSubdomain(req.Subdomain);
        var theme = NormalizeTheme(req.Theme);
        await EnsureResumeOwnedAsync(userId, req.ResumeId, ct);

        if (await _db.PortfolioSites.AnyAsync(p => p.Subdomain == sub, ct))
            throw new ArgumentException("This subdomain is already taken.");

        var site = new PortfolioSite
        {
            UserId = userId,
            ResumeId = req.ResumeId,
            Subdomain = sub,
            Theme = theme,
            Status = PortfolioStatus.Pending,
        };
        _db.PortfolioSites.Add(site);
        await SaveHandlingRaceAsync(ct);
        return await ToDtoAsync(site, ct);
    }

    public async Task<PortfolioDto> UpdateAsync(Guid userId, UpdatePortfolioRequest req, CancellationToken ct = default)
    {
        var site = await _db.PortfolioSites.FirstOrDefaultAsync(p => p.UserId == userId, ct)
            ?? throw new KeyNotFoundException("You don't have a portfolio yet.");

        if (req.Subdomain is not null)
        {
            var sub = NormalizeAndValidateSubdomain(req.Subdomain);
            if (sub != site.Subdomain)
            {
                if (await _db.PortfolioSites.AnyAsync(p => p.Subdomain == sub && p.UserId != userId, ct))
                    throw new ArgumentException("This subdomain is already taken.");
                site.Subdomain = sub;
            }
        }

        if (req.ResumeId is { } resumeId && resumeId != site.ResumeId)
        {
            await EnsureResumeOwnedAsync(userId, resumeId, ct);
            site.ResumeId = resumeId;
        }

        if (req.Theme is not null) site.Theme = NormalizeTheme(req.Theme);
        if (req.HideContact is { } hide) site.HideContact = hide;

        // Status is intentionally NOT reset — once Approved the user edits freely without re-approval.
        site.UpdatedAt = DateTime.UtcNow;
        await SaveHandlingRaceAsync(ct);
        return await ToDtoAsync(site, ct);
    }

    public async Task DeleteAsync(Guid userId, CancellationToken ct = default)
    {
        var site = await _db.PortfolioSites.FirstOrDefaultAsync(p => p.UserId == userId, ct)
            ?? throw new KeyNotFoundException("You don't have a portfolio yet.");
        _db.PortfolioSites.Remove(site);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<PublicPortfolioDto?> GetPublicAsync(string subdomain, CancellationToken ct = default)
    {
        var sub = (subdomain ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(sub)) return null;

        // Security boundary: only Approved sites are ever served publicly.
        var site = await _db.PortfolioSites
            .FirstOrDefaultAsync(p => p.Subdomain == sub && p.Status == PortfolioStatus.Approved, ct);
        if (site is null) return null;

        // ParsedDataJson is auto-decrypted by EF's EncryptedStringConverter on read.
        var resume = await _db.Resumes.FirstOrDefaultAsync(r => r.Id == site.ResumeId, ct);
        if (resume is null || string.IsNullOrEmpty(resume.ParsedDataJson)) return null;

        var data = JsonSerializer.Deserialize<ResumeFormDataDto>(resume.ParsedDataJson, JsonOptions);
        if (data is null) return null;

        if (site.HideContact)
        {
            // Blank contact fields server-side so they never reach the client.
            data = data with { Email = "", Phone = "" };
        }

        return new PublicPortfolioDto(site.Theme, site.HideContact, data);
    }

    public async Task<List<AdminPortfolioDto>> ListForAdminAsync(PortfolioStatus? status, CancellationToken ct = default)
    {
        var query = _db.PortfolioSites.AsNoTracking().AsQueryable();
        if (status is { } s) query = query.Where(p => p.Status == s);

        var sites = await query.OrderByDescending(p => p.CreatedAt).ToListAsync(ct);
        if (sites.Count == 0) return new();

        var resumeIds = sites.Select(p => p.ResumeId).Distinct().ToList();
        var titles = await _db.Resumes.AsNoTracking()
            .Where(r => resumeIds.Contains(r.Id))
            .Select(r => new { r.Id, r.Title })
            .ToDictionaryAsync(r => r.Id, r => r.Title, ct);

        // UserEmail is filled in by the controller (it owns the user DB).
        return sites.Select(p => new AdminPortfolioDto(
            p.Id, p.UserId, null, p.Subdomain, p.Theme, p.Status.ToString(),
            p.ResumeId, titles.GetValueOrDefault(p.ResumeId), p.CreatedAt, p.UpdatedAt)).ToList();
    }

    public async Task ApproveAsync(Guid siteId, string adminEmail, CancellationToken ct = default)
    {
        var site = await _db.PortfolioSites.FirstOrDefaultAsync(p => p.Id == siteId, ct)
            ?? throw new KeyNotFoundException("Portfolio request not found.");
        site.Status = PortfolioStatus.Approved;
        site.ReviewedByEmail = adminEmail;
        site.ReviewedAt = DateTime.UtcNow;
        site.RejectReason = null;
        site.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task RejectAsync(Guid siteId, string adminEmail, string reason, CancellationToken ct = default)
    {
        var site = await _db.PortfolioSites.FirstOrDefaultAsync(p => p.Id == siteId, ct)
            ?? throw new KeyNotFoundException("Portfolio request not found.");
        site.Status = PortfolioStatus.Rejected;
        site.ReviewedByEmail = adminEmail;
        site.ReviewedAt = DateTime.UtcNow;
        site.RejectReason = string.IsNullOrWhiteSpace(reason) ? "Request rejected." : reason.Trim();
        site.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    // Unique indexes on UserId/Subdomain can race under concurrent requests; surface a clean 400.
    private async Task SaveHandlingRaceAsync(CancellationToken ct)
    {
        try { await _db.SaveChangesAsync(ct); }
        catch (DbUpdateException)
        {
            throw new ArgumentException("That subdomain was just taken, or you already have a portfolio. Please try again.");
        }
    }
}
