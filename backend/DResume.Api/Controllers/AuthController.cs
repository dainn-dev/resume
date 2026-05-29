using DainnUser.Core.Interfaces.Services;
using DainnUser.Core.Models.Authentication;
using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/auth")]
[AllowAnonymous]
public sealed class AuthController : ControllerBase
{
    private readonly IAuthenticationService _auth;

    public AuthController(IAuthenticationService auth) => _auth = auth;

    [HttpPost("register")]
    [RequiresRecaptcha]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req, CancellationToken ct)
    {
        var username = string.IsNullOrWhiteSpace(req.Username) ? req.Email : req.Username!;
        var userId = await _auth.RegisterAsync(req.Email, username, req.Password, ct);
        return StatusCode(201, ApiResult.Ok(new
        {
            userId,
            email = req.Email,
            message = "Registration successful. Please check your email to verify your account."
        }));
    }

    [HttpPost("login")]
    [RequiresRecaptcha]
    public async Task<IActionResult> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty;
        var ua = Request.Headers.UserAgent.ToString();
        var rememberDevice = Request.Headers["X-Remember-Device-Token"].ToString();
        var result = await _auth.LoginAsync(req.Email, req.Password, ip, ua, rememberDevice, ct);
        return Ok(ApiResult.Ok(ToResponse(result)));
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest req, CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty;
        var ua = Request.Headers.UserAgent.ToString();
        var result = await _auth.RefreshTokenAsync(req.RefreshToken, ip, ua, ct);
        return Ok(ApiResult.Ok(ToResponse(result)));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout(
        [FromServices] ICurrentUser current,
        [FromServices] ISessionService sessions,
        CancellationToken ct)
    {
        var sessionId = current.SessionId;
        if (sessionId.HasValue)
            await _auth.LogoutAsync(sessionId.Value, ct);
        else
            await sessions.RevokeAllSessionsAsync(current.RequireUserId(), ct);
        return Ok(ApiResult.Ok(new { loggedOut = true }));
    }

    [HttpPost("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest req, CancellationToken ct)
    {
        await _auth.VerifyEmailAsync(req.UserId, req.Token, ct);
        return Ok(ApiResult.Ok(new { verified = true }));
    }

    [HttpPost("resend-verification")]
    public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationRequest req, CancellationToken ct)
    {
        await _auth.ResendVerificationEmailAsync(req.Email, ct);
        return Ok(ApiResult.Ok(new { sent = true }));
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req, CancellationToken ct)
    {
        await _auth.ForgotPasswordAsync(req.Email, ct);
        return Ok(ApiResult.Ok(new { sent = true }));
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req, CancellationToken ct)
    {
        await _auth.ResetPasswordAsync(req.Token, req.NewPassword, ct);
        return Ok(ApiResult.Ok(new { reset = true }));
    }

    [HttpPost("2fa/complete")]
    public async Task<IActionResult> CompleteTwoFactor([FromBody] TwoFactorCompleteRequest req, CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty;
        var ua = Request.Headers.UserAgent.ToString();
        var result = await _auth.CompleteTwoFactorLoginAsync(req.UserId, req.Code, req.RememberDevice, ip, ua, ct);
        return Ok(ApiResult.Ok(ToResponse(result)));
    }

    private static AuthResponse ToResponse(LoginResult r) => new(
        r.AccessToken,
        r.RefreshToken,
        r.AccessTokenExpiresAt,
        r.RefreshTokenExpiresAt,
        r.SessionId,
        r.User,
        r.RequiresTwoFactor,
        r.TwoFactorUserId);
}
