namespace DResume.Api.Contracts;

public sealed record RegisterRequest(string Email, string Password, string? Username);

public sealed record LoginRequest(string Email, string Password);

public sealed record GoogleLoginRequest(string AuthorizationCode, string CallbackUrl);

public sealed record RefreshRequest(string RefreshToken);

public sealed record VerifyEmailRequest(Guid UserId, string Token);

public sealed record ResendVerificationRequest(string Email);

public sealed record ForgotPasswordRequest(string Email);

public sealed record ResetPasswordRequest(string Token, string NewPassword);

public sealed record TwoFactorCompleteRequest(Guid UserId, string Code, bool RememberDevice);

public sealed record UpdateProfileRequest(
    string? FirstName,
    string? LastName,
    string? DisplayName,
    string? Bio,
    string? Language,
    string? Timezone,
    string? AvatarUrl,
    string? Website,
    string? Gender,
    DateTime? DateOfBirth);

public sealed record AuthResponse(
    string AccessToken,
    string? RefreshToken,
    DateTime AccessTokenExpiresAt,
    DateTime? RefreshTokenExpiresAt,
    Guid? SessionId,
    object? User,
    bool RequiresTwoFactor,
    Guid? TwoFactorUserId);
