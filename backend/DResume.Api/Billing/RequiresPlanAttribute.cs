using DResume.Api.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace DResume.Api.Billing;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class RequiresPlanAttribute : Attribute, IAsyncActionFilter
{
    public PlanCode MinPlan { get; }

    public RequiresPlanAttribute(PlanCode minPlan) => MinPlan = minPlan;

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
        if ((int)plan.Code < (int)MinPlan)
        {
            context.Result = new ObjectResult(new ApiResult<object>(
                false,
                new
                {
                    requiredPlan = MinPlan.ToString(),
                    currentPlan = plan.Code.ToString(),
                    upgradeUrl = "/api/billing/checkout"
                },
                $"This feature requires the {MinPlan} plan or higher."))
            { StatusCode = 402 };
            return;
        }

        await next();
    }
}
