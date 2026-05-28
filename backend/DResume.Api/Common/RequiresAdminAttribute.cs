using DResume.Api.Billing;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace DResume.Api.Common;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class RequiresAdminAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var current = context.HttpContext.RequestServices.GetRequiredService<ICurrentUser>();
        if (current.UserId is null)
        {
            context.Result = new ObjectResult(new ApiResult<object>(false, null, "Authentication required.")) { StatusCode = 401 };
            return;
        }

        var plans = context.HttpContext.RequestServices.GetRequiredService<IPlanService>();
        if (!plans.IsAdmin())
        {
            context.Result = new ObjectResult(new ApiResult<object>(false, null, "Admin access required.")) { StatusCode = 403 };
            return;
        }

        await next();
    }
}
