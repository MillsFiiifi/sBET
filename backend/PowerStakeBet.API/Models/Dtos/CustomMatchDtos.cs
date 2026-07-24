using System.ComponentModel.DataAnnotations;

namespace PowerStakeBet.API.Models.Dtos;

public record CustomMatchDto(
    [Required] string Sport,
    [Required] string League,
    string Country,
    [Required] string HomeTeam,
    [Required] string AwayTeam,
    int? HomeScore,
    int? AwayScore,
    string? Minute,
    string? StartTime,
    DateTime? StartTimeUtc,
    bool IsLive,
    [Range(1.01, double.MaxValue)] decimal OddsHome,
    decimal OddsDraw,
    [Range(1.01, double.MaxValue)] decimal OddsAway
);

public record CustomMatchResponseDto(
    Guid Id,
    string Sport,
    string League,
    string Country,
    string HomeTeam,
    string AwayTeam,
    int? HomeScore,
    int? AwayScore,
    string? Minute,
    string? StartTime,
    DateTime? StartTimeUtc,
    bool IsLive,
    decimal OddsHome,
    decimal OddsDraw,
    decimal OddsAway,
    DateTime CreatedAt
);

public record AdminLoginDto([Required] string Password);

public record AdminStatsDto(
    int TotalUsers,
    int TotalBets,
    int PendingBets,
    int SubAdmins,
    int CustomMatches,
    decimal TotalDeposited,
    decimal TotalWithdrawn,
    decimal TotalCommissionsPaid
);
