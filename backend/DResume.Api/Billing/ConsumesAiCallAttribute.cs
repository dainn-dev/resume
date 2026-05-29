using DResume.Api.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace DResume.Api.Billing;

/// <summary>
/// Enforces the plan's monthly AI-call quota on an endpoint: rejects with HTTP 402 when the
/// quota is already reached, and records one call after the action completes successfully.
/// Endpoints that may short-circuit without an AI call (e.g. a cache hit) should call
/// <see cref="SkipConsumption"/> so the call is not counted.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class ConsumesAiCallAttribute : Attribute, IAsyncActionFilter
{
    private const string SkipKey = "__skip_ai_consume";

    /// <summary>Marks the current request so its AI call is not counted (e.g. served from cache).</summary>
    public static void SkipConsumption(HttpContext ctx) => ctx.Items[SkipKey] = true;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var current = context.HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        var usage = context.HttpContext.RequestServices.GetRequiredService<IUsageService>();

        var userId = current.UserId;
        if (userId is null)
        {
            context.Result = new ObjectResult(new ApiResult<object>(false, null, "Authentication required.")) { StatusCode = 401 };
            return;
        }

        // Enforce before running the action (throws PlanLimitExceededException -> 402 via middleware).
        await usage.EnsureAiQuotaAsync(userId.Value, context.HttpContext.RequestAborted);

        var executed = await next();

        // Count only successful executions that actually performed an AI call.
        var skipped = context.HttpContext.Items.ContainsKey(SkipKey);
        if (!skipped && executed.Exception is null && IsSuccess(executed.Result))
        {
            await usage.ConsumeAiCallAsync(userId.Value, context.HttpContext.RequestAborted);
        }
    }

    private static bool IsSuccess(IActionResult? result)
    {
        if (result is ObjectResult obj)
        {
            var status = obj.StatusCode ?? 200;
            return status is >= 200 and < 300;
        }
        return result is OkResult or OkObjectResult;
    }
}
