using System.Net;
using System.Text.Json;
using DainnUser.Core.Exceptions;
using DResume.Api.Billing;

namespace DResume.Api.Common;

public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (UnauthorizedAccessException ex)
        {
            await WriteAsync(ctx, HttpStatusCode.Unauthorized, ex.Message);
        }
        catch (PlanLimitExceededException ex)
        {
            await WriteAsync(ctx, HttpStatusCode.PaymentRequired, ex.Message);
        }
        catch (ArgumentException ex)
        {
            await WriteAsync(ctx, HttpStatusCode.BadRequest, ex.Message);
        }
        catch (KeyNotFoundException ex)
        {
            await WriteAsync(ctx, HttpStatusCode.NotFound, ex.Message);
        }
        catch (InvalidCredentialsException ex)
        {
            await WriteAsync(ctx, HttpStatusCode.Unauthorized, ex.Message);
        }
        catch (InvalidRefreshTokenException ex)
        {
            await WriteAsync(ctx, HttpStatusCode.Unauthorized, ex.Message);
        }
        catch (InvalidTwoFactorCodeException ex)
        {
            await WriteAsync(ctx, HttpStatusCode.Unauthorized, ex.Message);
        }
        catch (EmailNotVerifiedException ex)
        {
            await WriteAsync(ctx, HttpStatusCode.Forbidden, ex.Message);
        }
        catch (AccountInactiveException ex)
        {
            await WriteAsync(ctx, HttpStatusCode.Forbidden, ex.Message);
        }
        catch (AccountLockedException ex)
        {
            await WriteAsync(ctx, (HttpStatusCode)423, ex.Message);
        }
        catch (TooManyVerificationAttemptsException ex)
        {
            await WriteAsync(ctx, HttpStatusCode.TooManyRequests, ex.Message);
        }
        catch (UserNotFoundException ex)
        {
            await WriteAsync(ctx, HttpStatusCode.NotFound, ex.Message);
        }
        catch (AddressNotFoundException ex)
        {
            await WriteAsync(ctx, HttpStatusCode.NotFound, ex.Message);
        }
        catch (ContactNotFoundException ex)
        {
            await WriteAsync(ctx, HttpStatusCode.NotFound, ex.Message);
        }
        catch (InvalidCurrentPasswordException ex)
        {
            await WriteAsync(ctx, HttpStatusCode.BadRequest, ex.Message);
        }
        catch (InvalidPasswordResetTokenException ex)
        {
            await WriteAsync(ctx, HttpStatusCode.BadRequest, ex.Message);
        }
        catch (InvalidVerificationCodeException ex)
        {
            await WriteAsync(ctx, HttpStatusCode.BadRequest, ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogError(ex, "Operation failed on {Path}", ctx.Request.Path);
            await WriteAsync(ctx, HttpStatusCode.BadGateway, ex.Message);
        }
        catch (System.Text.Json.JsonException ex)
        {
            _logger.LogError(ex, "JSON parse failed on {Path}", ctx.Request.Path);
            await WriteAsync(ctx, HttpStatusCode.BadGateway, "AI response could not be parsed. Please retry.");
        }
        catch (TaskCanceledException ex) when (!ctx.RequestAborted.IsCancellationRequested)
        {
            _logger.LogError(ex, "Upstream timeout on {Path}", ctx.Request.Path);
            await WriteAsync(ctx, HttpStatusCode.GatewayTimeout, "AI request timed out. Please retry.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception on {Path}", ctx.Request.Path);
            await WriteAsync(ctx, HttpStatusCode.InternalServerError, "An unexpected error occurred.");
        }
    }

    private static Task WriteAsync(HttpContext ctx, HttpStatusCode status, string error)
    {
        if (ctx.Response.HasStarted) return Task.CompletedTask;
        ctx.Response.Clear();
        ctx.Response.StatusCode = (int)status;
        ctx.Response.ContentType = "application/json; charset=utf-8";
        var payload = new ApiResult<object>(false, null, error);
        return ctx.Response.WriteAsync(JsonSerializer.Serialize(payload, JsonOptions));
    }
}
