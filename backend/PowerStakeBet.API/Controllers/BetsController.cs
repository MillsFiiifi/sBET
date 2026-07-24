using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PowerStakeBet.API.Models.Dtos;
using PowerStakeBet.API.Services;

namespace PowerStakeBet.API.Controllers;

[ApiController]
[Route("api/bets")]
public class BetsController : ControllerBase
{
    private readonly IBetsService _bets;

    public BetsController(IBetsService bets) { _bets = bets; }

    [HttpPost]
    public async Task<ActionResult<BetResponseDto>> Place([FromBody] PlaceBetDto dto)
    {
        try
        {
            var bet = await _bets.PlaceAsync(dto);
            return CreatedAtAction(nameof(GetById), new { id = bet.Id }, bet);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet]
    public async Task<ActionResult<List<BetResponseDto>>> List([FromQuery] Guid? userId, [FromQuery] string? code)
    {
        if (!string.IsNullOrWhiteSpace(code))
        {
            var found = await _bets.GetByCodeAsync(code);
            return found is null ? NotFound(new { error = "bet not found" }) : Ok(new[] { found });
        }
        var bets = await _bets.ListAsync(userId);
        return Ok(bets);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BetResponseDto>> GetById(Guid id)
    {
        var bet = await _bets.GetByIdAsync(id);
        return bet is null ? NotFound(new { error = "bet not found" }) : Ok(bet);
    }

    [Authorize(Roles = "admin")]
    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<BetResponseDto>> UpdateStatus(Guid id, [FromBody] UpdateBetStatusDto dto)
    {
        var bet = await _bets.UpdateStatusAsync(id, dto);
        return bet is null ? NotFound(new { error = "bet not found" }) : Ok(bet);
    }

    [Authorize(Roles = "admin")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var ok = await _bets.DeleteAsync(id);
        return ok ? NoContent() : NotFound(new { error = "bet not found" });
    }
}
