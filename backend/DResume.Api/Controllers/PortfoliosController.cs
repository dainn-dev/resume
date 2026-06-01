using DResume.Api.Billing;
using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Features.Portfolio;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/portfolios")]
[Authorize]
[RequiresPlan(PlanCode.Premium)]
public sealed class PortfoliosController : ControllerBase
{
    private readonly ICurrentUser _current;
    private readonly IPortfolioService _portfolios;

    public PortfoliosController(ICurrentUser current, IPortfolioService portfolios)
    {
        _current = current;
        _portfolios = portfolios;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMine(CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var dto = await _portfolios.GetMineAsync(userId, ct);
        return Ok(ApiResult.Ok(dto));
    }

    [HttpGet("check")]
    public async Task<IActionResult> Check([FromQuery] string subdomain, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var result = await _portfolios.CheckAvailabilityAsync(subdomain ?? "", userId, ct);
        return Ok(ApiResult.Ok(result));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePortfolioRequest req, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var dto = await _portfolios.CreateAsync(userId, req, ct);
        return Ok(ApiResult.Ok(dto));
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdatePortfolioRequest req, CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        var dto = await _portfolios.UpdateAsync(userId, req, ct);
        return Ok(ApiResult.Ok(dto));
    }

    [HttpDelete]
    public async Task<IActionResult> Delete(CancellationToken ct)
    {
        var userId = _current.RequireUserId();
        await _portfolios.DeleteAsync(userId, ct);
        return Ok(ApiResult.Ok(new { deleted = true }));
    }
}
