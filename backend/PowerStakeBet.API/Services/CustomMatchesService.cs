using Microsoft.EntityFrameworkCore;
using PowerStakeBet.API.Data;
using PowerStakeBet.API.Models.Dtos;
using PowerStakeBet.API.Models.Entities;

namespace PowerStakeBet.API.Services;

public interface ICustomMatchesService
{
    Task<List<CustomMatchResponseDto>> ListAsync(string? sport);
    Task<CustomMatchResponseDto> CreateAsync(CustomMatchDto dto);
    Task<CustomMatchResponseDto?> UpdateAsync(Guid id, CustomMatchDto dto);
    Task<bool> DeleteAsync(Guid id);
}

public class CustomMatchesService : ICustomMatchesService
{
    private readonly PowerStakeBetDbContext _db;

    public CustomMatchesService(PowerStakeBetDbContext db) { _db = db; }

    public async Task<List<CustomMatchResponseDto>> ListAsync(string? sport)
    {
        var query = _db.CustomMatches.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(sport))
        {
            var s = sport.Trim().ToLowerInvariant();
            query = query.Where(m => m.Sport.ToLower() == s);
        }
        return await query
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => ToDto(m))
            .ToListAsync();
    }

    public async Task<CustomMatchResponseDto> CreateAsync(CustomMatchDto dto)
    {
        var m = new CustomMatch
        {
            Sport = dto.Sport.Trim().ToLowerInvariant(),
            League = dto.League.Trim(),
            Country = dto.Country?.Trim() ?? string.Empty,
            HomeTeam = dto.HomeTeam.Trim(),
            AwayTeam = dto.AwayTeam.Trim(),
            HomeScore = dto.HomeScore,
            AwayScore = dto.AwayScore,
            Minute = dto.Minute,
            StartTime = dto.StartTime,
            StartTimeUtc = dto.StartTimeUtc,
            IsLive = dto.IsLive,
            OddsHome = dto.OddsHome,
            OddsDraw = dto.OddsDraw,
            OddsAway = dto.OddsAway,
        };
        _db.CustomMatches.Add(m);
        await _db.SaveChangesAsync();
        return ToDto(m);
    }

    public async Task<CustomMatchResponseDto?> UpdateAsync(Guid id, CustomMatchDto dto)
    {
        var m = await _db.CustomMatches.FindAsync(id);
        if (m is null) return null;
        m.Sport = dto.Sport.Trim().ToLowerInvariant();
        m.League = dto.League.Trim();
        m.Country = dto.Country?.Trim() ?? string.Empty;
        m.HomeTeam = dto.HomeTeam.Trim();
        m.AwayTeam = dto.AwayTeam.Trim();
        m.HomeScore = dto.HomeScore;
        m.AwayScore = dto.AwayScore;
        m.Minute = dto.Minute;
        m.StartTime = dto.StartTime;
        m.StartTimeUtc = dto.StartTimeUtc;
        m.IsLive = dto.IsLive;
        m.OddsHome = dto.OddsHome;
        m.OddsDraw = dto.OddsDraw;
        m.OddsAway = dto.OddsAway;
        await _db.SaveChangesAsync();
        return ToDto(m);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var m = await _db.CustomMatches.FindAsync(id);
        if (m is null) return false;
        _db.CustomMatches.Remove(m);
        await _db.SaveChangesAsync();
        return true;
    }

    private static CustomMatchResponseDto ToDto(CustomMatch m) => new(
        m.Id, m.Sport, m.League, m.Country, m.HomeTeam, m.AwayTeam,
        m.HomeScore, m.AwayScore, m.Minute, m.StartTime, m.StartTimeUtc,
        m.IsLive, m.OddsHome, m.OddsDraw, m.OddsAway, m.CreatedAt);
}
