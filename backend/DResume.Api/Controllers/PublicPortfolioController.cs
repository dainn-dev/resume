using DResume.Api.Common;
using DResume.Api.Features.Portfolio;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DResume.Api.Controllers;

// The only anonymous portfolio endpoint. Serves Approved sites as public portfolio data.
[ApiController]
[Route("api/public/portfolio")]
[AllowAnonymous]
public sealed class PublicPortfolioController : ControllerBase
{
    private readonly IPortfolioService _portfolios;

    public PublicPortfolioController(IPortfolioService portfolios) => _portfolios = portfolios;

    [HttpGet("{subdomain}")]
    public async Task<IActionResult> Get(string subdomain, CancellationToken ct)
    {
        var dto = await _portfolios.GetPublicAsync(subdomain, ct);
        if (dto is null) throw new KeyNotFoundException("Portfolio not found.");
        return Ok(ApiResult.Ok(dto));
    }
}
