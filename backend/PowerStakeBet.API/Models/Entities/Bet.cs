using System.ComponentModel.DataAnnotations;

namespace PowerStakeBet.API.Models.Entities;

public class Bet
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(12)]
    public string Code { get; set; } = string.Empty;

    public Guid? UserId { get; set; }
    public User? User { get; set; }

    public DateTime PlacedAt { get; set; } = DateTime.UtcNow;

    public decimal Stake { get; set; }
    public decimal TotalOdds { get; set; }
    public decimal PotentialWin { get; set; }

    [Required, MaxLength(20)]
    public string Status { get; set; } = "pending"; // pending | won | lost

    public DateTime? SettledAt { get; set; }
    public decimal? Payout { get; set; }

    public ICollection<BetSelection> Selections { get; set; } = new List<BetSelection>();
}

public class BetSelection
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid BetId { get; set; }
    public Bet Bet { get; set; } = null!;

    [Required, MaxLength(64)]
    public string MatchId { get; set; } = string.Empty;

    [MaxLength(120)]
    public string HomeTeam { get; set; } = string.Empty;

    [MaxLength(120)]
    public string AwayTeam { get; set; } = string.Empty;

    [MaxLength(120)]
    public string League { get; set; } = string.Empty;

    [MaxLength(120)]
    public string Country { get; set; } = string.Empty;

    [MaxLength(32)]
    public string MarketKey { get; set; } = string.Empty;

    [MaxLength(120)]
    public string MarketLabel { get; set; } = string.Empty;

    [MaxLength(120)]
    public string OutcomeKey { get; set; } = string.Empty;

    [MaxLength(120)]
    public string OutcomeLabel { get; set; } = string.Empty;

    public decimal Odds { get; set; }
}
