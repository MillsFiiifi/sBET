using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PowerStakeBet.API.Models.Dtos;
using PowerStakeBet.API.Services;
using System.Security.Claims;

namespace PowerStakeBet.API.Controllers;

[ApiController]
[Route("api/sub-admin")]
public class SubAdminsController : ControllerBase
{
    private readonly ISubAdminsService _service;
    private readonly IJwtService _jwt;

    public SubAdminsController(ISubAdminsService service, IJwtService jwt)
    {
        _service = service;
        _jwt = jwt;
    }

    [HttpPost("register")]
    public async Task<ActionResult<SubAdminAuthResponseDto>> Register([FromBody] RegisterSubAdminDto dto)
    {
        try
        {
            var sa = await _service.RegisterAsync(dto);
            var (token, expires) = _jwt.Issue(sa.Id.ToString(), "sub-admin",
                new[] { new Claim(ClaimTypes.Email, sa.Email) });
            return CreatedAtAction(nameof(Me), null,
                new SubAdminAuthResponseDto(token, expires, sa));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpPost("login")]
    public async Task<ActionResult<SubAdminAuthResponseDto>> Login([FromBody] LoginDto dto)
    {
        var sa = await _service.LoginAsync(dto);
        if (sa is null) return Unauthorized(new { error = "invalid credentials" });
        if (!sa.Approved) return StatusCode(403, new { error = "account pending approval" });

        var (token, expires) = _jwt.Issue(sa.Id.ToString(), "sub-admin",
            new[] { new Claim(ClaimTypes.Email, sa.Email) });
        return Ok(new SubAdminAuthResponseDto(token, expires, sa));
    }

    [Authorize(Roles = "sub-admin")]
    [HttpGet("me")]
    public async Task<ActionResult<SubAdminResponseDto>> Me()
    {
        var sub = User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
        if (!Guid.TryParse(sub, out var id)) return Unauthorized();
        var sa = await _service.GetByIdAsync(id);
        return sa is null ? NotFound() : Ok(sa);
    }

    [Authorize(Roles = "sub-admin")]
    [HttpGet("me/commissions")]
    public async Task<ActionResult<List<CommissionListItemDto>>> MyCommissions()
    {
        var sub = User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
        if (!Guid.TryParse(sub, out var id)) return Unauthorized();
        return Ok(await _service.ListCommissionsAsync(id));
    }
}
