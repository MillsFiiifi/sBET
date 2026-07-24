using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PowerStakeBet.API.Configuration;
using PowerStakeBet.API.Data;
using PowerStakeBet.API.Models.Dtos;
using PowerStakeBet.API.Services;

namespace PowerStakeBet.API.Controllers;

[ApiController]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    private readonly PowerStakeBetDbContext _db;
    private readonly IJwtService _jwt;
    private readonly ISubAdminsService _subAdmins;
    private readonly AdminSettings _settings;

    public AdminController(
        PowerStakeBetDbContext db,
        IJwtService jwt,
        ISubAdminsService subAdmins,
        IOptions<AdminSettings> settings)
    {
        _db = db;
        _jwt = jwt;
        _subAdmins = subAdmins;
        _settings = settings.Value;
    }

    [HttpPost("login")]
    public ActionResult<AuthResponseDto> Login([FromBody] AdminLoginDto dto)
    {
        if (string.IsNullOrWhiteSpace(_settings.Password))
            return StatusCode(503, new { error = "admin login is disabled (no password configured)" });

        if (dto.Password != _settings.Password)
            return Unauthorized(new { error = "wrong password" });

        var (token, expires) = _jwt.Issue("admin", "admin");
        return Ok(new { token, expiresAt = expires });
    }

    [Authorize(Roles = "admin")]
    [HttpGet("status")]
    public IActionResult Status() => Ok(new { authenticated = true });

    [Authorize(Roles = "admin")]
    [HttpGet("stats")]
    public async Task<ActionResult<AdminStatsDto>> Stats()
    {
        return Ok(new AdminStatsDto(
            TotalUsers: await _db.Users.CountAsync(),
            TotalBets: await _db.Bets.CountAsync(),
            PendingBets: await _db.Bets.CountAsync(b => b.Status == "pending"),
            SubAdmins: await _db.SubAdmins.CountAsync(),
            CustomMatches: await _db.CustomMatches.CountAsync(),
            TotalDeposited: await _db.Users.SumAsync(u => (decimal?)u.TotalDeposited) ?? 0m,
            TotalWithdrawn: await _db.Users.SumAsync(u => (decimal?)u.TotalWithdrawn) ?? 0m,
            TotalCommissionsPaid: await _db.SubAdmins.SumAsync(s => (decimal?)s.TotalCommissionEarned) ?? 0m
        ));
    }

    [Authorize(Roles = "admin")]
    [HttpGet("sub-admins")]
    public async Task<ActionResult<List<SubAdminResponseDto>>> ListSubAdmins() =>
        Ok(await _subAdmins.ListAsync());

    [Authorize(Roles = "admin")]
    [HttpPatch("sub-admins/{id:guid}")]
    public async Task<ActionResult<SubAdminResponseDto>> SetApproval(Guid id, [FromBody] ApproveSubAdminDto dto)
    {
        var sa = await _subAdmins.SetApprovedAsync(id, dto.Approved);
        return sa is null ? NotFound(new { error = "sub-admin not found" }) : Ok(sa);
    }

    [Authorize(Roles = "admin")]
    [HttpDelete("sub-admins/{id:guid}")]
    public async Task<IActionResult> DeleteSubAdmin(Guid id)
    {
        var ok = await _subAdmins.DeleteAsync(id);
        return ok ? NoContent() : NotFound(new { error = "sub-admin not found" });
    }
}
