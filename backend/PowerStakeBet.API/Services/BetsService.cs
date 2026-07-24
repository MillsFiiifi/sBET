using Microsoft.EntityFrameworkCore;
using PowerStakeBet.API.Data;
using PowerStakeBet.API.Models.Dtos;
using PowerStakeBet.API.Models.Entities;
using System.Security.Cryptography;

namespace PowerStakeBet.API.Services;

public interface IBetsService
{
    Task<BetResponseDto> PlaceAsync(PlaceBetDto dto);
    Task<List<BetResponseDto>> ListAsync(Guid? userId = null);
    Task<BetResponseDto?> GetByIdAsync(Guid id);
    Task<BetResponseDto?> GetByCodeAsync(string code);
    Task<BetResponseDto?> UpdateStatusAsync(Guid id, UpdateBetStatusDto dto);
    Task<bool> DeleteAsync(Guid id);
}

public class BetsService : IBetsService
{
    private const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private readonly PowerStakeBetDbContext _db;

    public BetsService(PowerStakeBetDbContext db) { _db = db; }

    public async Task<BetResponseDto> PlaceAsync(PlaceBetDto dto)
    {
        if (dto.Selections is null || dto.Selections.Count == 0)
            throw new ArgumentException("at least one selection required");

        var totalOdds = dto.Selections.Aggregate(1m, (acc, s) => acc * s.Odds);
        var bet = new Bet
        {
            Code = await GenerateUniqueCodeAsync(),
            UserId = dto.UserId,
            Stake = dto.Stake,
            TotalOdds = Math.Round(totalOdds, 4),
            PotentialWin = Math.Round(dto.Stake * totalOdds, 2),
            Status = "pending",
            Selections = dto.Selections.Select(s => new BetSelection
            {
                MatchId = s.MatchId,
                HomeTeam = s.HomeTeam ?? string.Empty,
                AwayTeam = s.AwayTeam ?? string.Empty,
                League = s.League ?? string.Empty,
                Country = s.Country ?? string.Empty,
                MarketKey = s.MarketKey,
                MarketLabel = s.MarketLabel ?? string.Empty,
                OutcomeKey = s.OutcomeKey,
                OutcomeLabel = s.OutcomeLabel ?? string.Empty,
                Odds = s.Odds,
            }).ToList(),
        };

        _db.Bets.Add(bet);
        await _db.SaveChangesAsync();
        return ToDto(bet);
    }

    public async Task<List<BetResponseDto>> ListAsync(Guid? userId = null)
    {
        var query = _db.Bets.AsNoTracking().Include(b => b.Selections).AsQueryable();
        if (userId.HasValue) query = query.Where(b => b.UserId == userId);
        var bets = await query.OrderByDescending(b => b.PlacedAt).Take(200).ToListAsync();
        return bets.Select(ToDto).ToList();
    }

    public async Task<BetResponseDto?> GetByIdAsync(Guid id)
    {
        var bet = await _db.Bets.AsNoTracking().Include(b => b.Selections).FirstOrDefaultAsync(b => b.Id == id);
        return bet is null ? null : ToDto(bet);
    }

    public async Task<BetResponseDto?> GetByCodeAsync(string code)
    {
        var upper = code.Trim().ToUpperInvariant();
        var bet = await _db.Bets.AsNoTracking().Include(b => b.Selections).FirstOrDefaultAsync(b => b.Code == upper);
        return bet is null ? null : ToDto(bet);
    }

    public async Task<BetResponseDto?> UpdateStatusAsync(Guid id, UpdateBetStatusDto dto)
    {
        var bet = await _db.Bets.Include(b => b.Selections).FirstOrDefaultAsync(b => b.Id == id);
        if (bet is null) return null;
        bet.Status = dto.Status;
        if (dto.Status is "won" or "lost")
        {
            bet.SettledAt = DateTime.UtcNow;
            bet.Payout = dto.Status == "won" ? (dto.Payout ?? bet.PotentialWin) : 0m;
        }
        else
        {
            bet.SettledAt = null;
            bet.Payout = null;
        }
        await _db.SaveChangesAsync();
        return ToDto(bet);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var bet = await _db.Bets.FindAsync(id);
        if (bet is null) return false;
        _db.Bets.Remove(bet);
        await _db.SaveChangesAsync();
        return true;
    }

    private async Task<string> GenerateUniqueCodeAsync()
    {
        for (var i = 0; i < 20; i++)
        {
            var candidate = NewCode(6);
            if (!await _db.Bets.AnyAsync(b => b.Code == candidate)) return candidate;
        }
        return NewCode(8);
    }

    private static string NewCode(int length)
    {
        Span<char> buf = stackalloc char[length];
        for (var i = 0; i < length; i++)
            buf[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
        return new string(buf);
    }

    public static BetResponseDto ToDto(Bet b) => new(
        b.Id, b.Code, b.UserId, b.PlacedAt, b.Stake, b.TotalOdds,
        b.PotentialWin, b.Status, b.SettledAt, b.Payout,
        b.Selections.Select(s => new BetSelectionResponseDto(
            s.MatchId, s.HomeTeam, s.AwayTeam, s.League, s.Country,
            s.MarketKey, s.MarketLabel, s.OutcomeKey, s.OutcomeLabel, s.Odds
        )).ToList());
}
