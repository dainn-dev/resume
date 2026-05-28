using System.Security.Claims;

namespace DResume.Api.Common;

public interface ICurrentUser
{
    Guid? UserId { get; }
    Guid? SessionId { get; }
    Guid RequireUserId();
    string? Email { get; }
    string? DisplayName { get; }
}

public sealed class CurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _accessor;

    public CurrentUser(IHttpContextAccessor accessor) => _accessor = accessor;

    public Guid? UserId
    {
        get
        {
            var raw = _accessor.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? _accessor.HttpContext?.User?.FindFirstValue("sub");
            return Guid.TryParse(raw, out var id) ? id : null;
        }
    }

    public Guid? SessionId
    {
        get
        {
            var raw = _accessor.HttpContext?.User?.FindFirstValue("sid")
                      ?? _accessor.HttpContext?.User?.FindFirstValue("session_id");
            return Guid.TryParse(raw, out var id) ? id : null;
        }
    }

    public string? Email =>
        _accessor.HttpContext?.User?.FindFirstValue(ClaimTypes.Email)
        ?? _accessor.HttpContext?.User?.FindFirstValue("email");

    public string? DisplayName =>
        _accessor.HttpContext?.User?.FindFirstValue("unique_name")
        ?? _accessor.HttpContext?.User?.FindFirstValue(ClaimTypes.Name);

    public Guid RequireUserId() =>
        UserId ?? throw new UnauthorizedAccessException("Authenticated user id missing from token.");
}
