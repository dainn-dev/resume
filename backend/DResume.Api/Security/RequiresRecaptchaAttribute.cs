using DResume.Api.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace DResume.Api.Security;

/// <summary>
/// Verifies a Google reCAPTCHA v2 token before the action runs. The token is read from the
/// <c>X-Recaptcha-Token</c> request header (the Next.js proxy forwards it from the form body).
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class RequiresRecaptchaAttribute : Attribute, IAsyncActionFilter
{
    public const string HeaderName = "X-Recaptcha-Token";

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var verifier = context.HttpContext.RequestServices.GetRequiredService<IRecaptchaVerifier>();
        var token = context.HttpContext.Request.Headers[HeaderName].ToString();
        var ip = context.HttpContext.Connection.RemoteIpAddress?.ToString();

        if (!await verifier.VerifyAsync(token, ip, context.HttpContext.RequestAborted))
        {
            context.Result = new ObjectResult(ApiResult.Fail("Captcha verification failed. Please try again."))
            {
                StatusCode = 400
            };
            return;
        }

        await next();
    }
}
