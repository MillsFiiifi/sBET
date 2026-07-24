using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerStakeBet.API.Data;
using PowerStakeBet.API.Models.Dtos;
using PowerStakeBet.API.Services;

namespace PowerStakeBet.API.Controllers;

[ApiController]
[Route("api/matches")]
public class MatchesController : ControllerBase
{
    private readonly IOddsApiService _odds;
    private readonly PowerStakeBetDbContext _db;

    public MatchesController(IOddsApiService odds, PowerStakeBetDbContext db)
    {
        _odds = odds;
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string sport = "football",
        [FromQuery] int today = 0,
        [FromQuery] int tzOffset = 0)
    {
        var s = sport.ToLowerInvariant();
        var custom = await _db.CustomMatches
            .AsNoTracking()
            .Where(m => m.Sport.ToLower() == s)
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => new MatchDto(
                m.Id.ToString(),
                m.League,
                m.Country,
                m.HomeTeam,
                m.AwayTeam,
                m.IsLive,
                m.StartTime,
                m.StartTimeUtc != null ? m.StartTimeUtc.Value.ToString("o") : null,
                m.Minute,
                new OddsTriplet(m.OddsHome, m.OddsDraw, m.OddsAway),
                m.Sport))
            .ToListAsync();

        var oddsResult = await _odds.GetMatchesAsync(s, today == 1, tzOffset);

        var matches = new List<MatchDto>();
        matches.AddRange(custom);
        matches.AddRange(oddsResult.Matches);

        var source = oddsResult.Source == "odds-api"
            ? (custom.Count > 0 ? "mixed" : "odds-api")
            : (custom.Count > 0 ? "mixed-mock" : "mock");

        return Ok(new
        {
            source,
            reason = oddsResult.Reason,
            matches,
            customCount = custom.Count,
        });
    }
}
