using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Features.Build;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/build")]
[Authorize]
public sealed class BuildController : ControllerBase
{
    private readonly IResumeBuildService _service;

    public BuildController(IResumeBuildService service) => _service = service;

    [HttpPost]
    public async Task<IActionResult> Build([FromBody] BuildRequest req, CancellationToken ct)
    {
        var markdown = await _service.BuildAsync(req.Resume, ct);
        return Ok(ApiResult.Ok(new BuildResponse(markdown)));
    }
}
