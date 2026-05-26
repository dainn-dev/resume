using DResume.Api.Common;
using DResume.Api.Contracts;
using DResume.Api.Features.Translation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DResume.Api.Controllers;

[ApiController]
[Route("api/translate")]
[AllowAnonymous]
public sealed class TranslationController : ControllerBase
{
    private readonly ITranslationService _service;
    public TranslationController(ITranslationService service) => _service = service;

    [HttpPost]
    public async Task<IActionResult> Translate([FromBody] TranslateRequest req, CancellationToken ct)
    {
        if (req.Content is null || string.IsNullOrWhiteSpace(req.TargetLocale))
            throw new ArgumentException("Missing content or targetLocale.");

        var translated = await _service.TranslateAsync(req.Content, req.TargetLocale, ct);
        return Ok(ApiResult.Ok(translated));
    }
}
