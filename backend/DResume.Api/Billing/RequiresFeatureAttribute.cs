using DResume.Api.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace DResume.Api.Billing;

/// <summary>
/// Gates an endpoint behind a per-plan feature flag (see <see cref="Feature"/>). Unlike
/// <c>RequiresPlanAttribute</c> (which compares plan tiers), this reads the actual boolean
/// flag on the current plan, so admin edits to the DB plan catalog take effect immediately.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class RequiresFeatureAttribute : Attribute, IAsyncActionFilter
{
    public Feature Feature { get; }

    public RequiresFeatureAttribute(Feature feature) => Feature = feature;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var current = context.HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        var planService = context.HttpContext.RequestServices.GetRequiredService<IPlanService>();

        var userId = current.UserId;
        if (userId is null)
        {
            context.Result = new ObjectResult(new ApiResult<object>(false, null, "Authentication required.")) { StatusCode = 401 };
            return;
        }

        var plan = await planService.GetCurrentPlanAsync(userId.Value, context.HttpContext.RequestAborted);
        if (!Feature.IsEnabledFor(plan.Limits))
        {
            context.Result = new ObjectResult(new ApiResult<object>(
                false,
                new
                {
                    feature = Feature.ToString(),
                    currentPlan = plan.Code.ToString(),
                    upgradeUrl = "/api/billing/checkout"
                },
                $"The {Feature.DisplayName()} feature is not available on your current plan."))
            { StatusCode = 402 };
            return;
        }

        await next();
    }
}
