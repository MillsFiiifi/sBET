using System.ComponentModel.DataAnnotations;

namespace PowerStakeBet.API.Models.Dtos;

public record PlaceBetDto(
    Guid? UserId,
    [Range(0.01, double.MaxValue)] decimal Stake,
    [Required, MinLength(1)] List<BetSelectionInputDto> Selections
);

public record BetSelectionInputDto(
    [Required] string MatchId,
    string HomeTeam,
    string AwayTeam,
    string League,
    string Country,
    [Required] string MarketKey,
    string MarketLabel,
    [Required] string OutcomeKey,
    string OutcomeLabel,
    [Range(1.01, double.MaxValue)] decimal Odds
);

public record BetResponseDto(
    Guid Id,
    string Code,
    Guid? UserId,
    DateTime PlacedAt,
    decimal Stake,
    decimal TotalOdds,
    decimal PotentialWin,
    string Status,
    DateTime? SettledAt,
    decimal? Payout,
    List<BetSelectionResponseDto> Selections
);

public record BetSelectionResponseDto(
    string MatchId,
    string HomeTeam,
    string AwayTeam,
    string League,
    string Country,
    string MarketKey,
    string MarketLabel,
    string OutcomeKey,
    string OutcomeLabel,
    decimal Odds
);

public record UpdateBetStatusDto(
    [Required, RegularExpression("^(pending|won|lost)$")] string Status,
    decimal? Payout
);
