using Microsoft.AspNetCore.Mvc;
using PowerStakeBet.API.Models.Dtos;
using PowerStakeBet.API.Services;
using System.Security.Claims;

namespace PowerStakeBet.API.Controllers;

[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly IUsersService _users;
    private readonly IJwtService _jwt;

    public UsersController(IUsersService users, IJwtService jwt)
    {
        _users = users;
        _jwt = jwt;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponseDto>> Register([FromBody] RegisterUserDto dto)
    {
        try
        {
            var user = await _users.RegisterAsync(dto);
            var (token, expires) = _jwt.Issue(user.Id.ToString(), "user",
                new[] { new Claim(ClaimTypes.Email, user.Email) });
            return CreatedAtAction(nameof(GetById), new { id = user.Id },
                new AuthResponseDto(token, expires, user));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginDto dto)
    {
        var user = await _users.LoginAsync(dto);
        if (user is null) return Unauthorized(new { error = "invalid credentials" });
        var (token, expires) = _jwt.Issue(user.Id.ToString(), "user",
            new[] { new Claim(ClaimTypes.Email, user.Email) });
        return Ok(new AuthResponseDto(token, expires, user));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserResponseDto>> GetById(Guid id)
    {
        var user = await _users.GetByIdAsync(id);
        return user is null ? NotFound(new { error = "user not found" }) : Ok(user);
    }

    [HttpPost("deposit")]
    public async Task<ActionResult<DepositResponseDto>> Deposit([FromBody] DepositDto dto)
    {
        var result = await _users.DepositAsync(dto);
        return result is null ? NotFound(new { error = "user not found" }) : Ok(result);
    }

    [HttpPost("withdraw")]
    public async Task<IActionResult> Withdraw([FromBody] WithdrawDto dto)
    {
        var outcome = await _users.WithdrawAsync(dto);
        return outcome switch
        {
            DepositOutcome.Success => Ok(await _users.GetByIdAsync(dto.UserId) is { } u
                ? new { user = u }
                : (object)new { user = (UserResponseDto?)null }),
            DepositOutcome.NotFound => NotFound(new { error = "user not found" }),
            DepositOutcome.NoDeposit => BadRequest(new { error = "make a deposit before withdrawing" }),
            DepositOutcome.InsufficientFunds => BadRequest(new { error = "insufficient funds" }),
            _ => StatusCode(500, new { error = "unexpected outcome" }),
        };
    }
}
