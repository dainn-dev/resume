using Microsoft.AspNetCore.StaticFiles;

namespace DResume.Api.Features.Resumes;

/// <summary>
/// Stores the original uploaded resume files (PDF/DOCX/TXT) on the local filesystem.
/// The root path comes from config key <c>Storage:UploadsPath</c> (mounted to a Docker
/// volume in production so files survive redeploys). Single-node only — for a multi-replica
/// deployment this would need shared storage (S3/NFS).
/// </summary>
public interface IFileStorageService
{
    /// <summary>Saves the file and returns the storage-relative path (e.g. "{userId}/{resumeId}.pdf").</summary>
    Task<StoredFileInfo> SaveAsync(Guid userId, Guid resumeId, IFormFile file, CancellationToken ct = default);

    /// <summary>Opens the stored file for reading. Throws FileNotFoundException if missing.</summary>
    Stream OpenRead(string relativePath);

    /// <summary>Deletes the stored file if it exists. No-op when the path is null/missing.</summary>
    void Delete(string? relativePath);
}

public sealed record StoredFileInfo(string RelativePath, string ContentType, long SizeBytes);

public sealed class FileStorageService : IFileStorageService
{
    private readonly string _root;
    private static readonly FileExtensionContentTypeProvider ContentTypes = new();

    public FileStorageService(IConfiguration config, IHostEnvironment env)
    {
        var configured = config["Storage:UploadsPath"];
        var path = string.IsNullOrWhiteSpace(configured) ? "uploads" : configured;
        // Resolve relative paths against the content root so dev runs land in the project folder.
        _root = Path.IsPathRooted(path) ? path : Path.Combine(env.ContentRootPath, path);
        Directory.CreateDirectory(_root);
    }

    public async Task<StoredFileInfo> SaveAsync(Guid userId, Guid resumeId, IFormFile file, CancellationToken ct = default)
    {
        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext) || ext.Length > 10) ext = ".bin";
        var relativePath = Path.Combine(userId.ToString("N"), resumeId.ToString("N") + ext);
        var fullPath = ResolveSafe(relativePath);

        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        await using (var dest = File.Create(fullPath))
        await using (var src = file.OpenReadStream())
        {
            await src.CopyToAsync(dest, ct);
        }

        var contentType = string.IsNullOrWhiteSpace(file.ContentType) || file.ContentType == "application/octet-stream"
            ? (ContentTypes.TryGetContentType(file.FileName, out var ct2) ? ct2 : "application/octet-stream")
            : file.ContentType;

        // Store relative paths with forward slashes so they're portable across OSes.
        return new StoredFileInfo(relativePath.Replace('\\', '/'), contentType, file.Length);
    }

    public Stream OpenRead(string relativePath)
    {
        var fullPath = ResolveSafe(relativePath);
        if (!File.Exists(fullPath)) throw new FileNotFoundException("Stored file not found.", relativePath);
        return File.OpenRead(fullPath);
    }

    public void Delete(string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath)) return;
        var fullPath = ResolveSafe(relativePath);
        if (File.Exists(fullPath)) File.Delete(fullPath);
    }

    // Combine against the root and verify the result stays inside it (path-traversal guard).
    private string ResolveSafe(string relativePath)
    {
        var full = Path.GetFullPath(Path.Combine(_root, relativePath));
        var rootFull = Path.GetFullPath(_root);
        if (!full.StartsWith(rootFull + Path.DirectorySeparatorChar, StringComparison.Ordinal) && full != rootFull)
            throw new UnauthorizedAccessException("Invalid file path.");
        return full;
    }
}
