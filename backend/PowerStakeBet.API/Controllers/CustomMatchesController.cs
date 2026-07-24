using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PowerStakeBet.API.Models.Dtos;
using PowerStakeBet.API.Services;

namespace PowerStakeBet.API.Controllers;

[ApiController]
[Route("api/admin/custom-matches")]
[Authorize(Roles = "admin")]
public class CustomMatchesController : ControllerBase
{
    private readonly ICustomMatchesService _service;

    public CustomMatchesController(ICustomMatchesService service) { _service = service; }

    [HttpGet]
    public async Task<ActionResult<List<CustomMatchResponseDto>>> List([FromQuery] string? sport) =>
        Ok(await _service.ListAsync(sport));

    [HttpPost]
    public async Task<ActionResult<CustomMatchResponseDto>> Create([FromBody] CustomMatchDto dto)
    {
        var match = await _service.CreateAsync(dto);
        return CreatedAtAction(nameof(List), null, match);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CustomMatchResponseDto>> Update(Guid id, [FromBody] CustomMatchDto dto)
    {
        var match = await _service.UpdateAsync(id, dto);
        return match is null ? NotFound(new { error = "match not found" }) : Ok(match);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var ok = await _service.DeleteAsync(id);
        return ok ? NoContent() : NotFound(new { error = "match not found" });
    }
}
