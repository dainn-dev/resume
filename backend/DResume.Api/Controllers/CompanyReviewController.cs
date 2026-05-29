using DResume.Api.Billing;
using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Features.CompanyReview;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/company-review")]
[Authorize]
[RequiresFeature(Feature.CompanyReview)]
public sealed class CompanyReviewController : ControllerBase
{
    private readonly ICompanyReviewService _service;
    private readonly ICurrentUser _current;

    public CompanyReviewController(ICompanyReviewService service, ICurrentUser current)
    {
        _service = service;
        _current = current;
    }

    [HttpPost]
    public async Task<IActionResult> Search([FromBody] CompanyReviewRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.CompanyName))
            return BadRequest(ApiResult.Fail("Company name is required."));
        var result = await _service.SearchAsync(req.CompanyName, _current.RequireUserId(), ct);
        return Ok(ApiResult.Ok(result));
    }

    [HttpGet("top-tech")]
    public async Task<IActionResult> TopTech(CancellationToken ct)
    {
        var result = await _service.GetTopTechCompaniesAsync(ct);
        return Ok(ApiResult.Ok(result));
    }
}
