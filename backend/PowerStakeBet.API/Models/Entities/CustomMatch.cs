using System.ComponentModel.DataAnnotations;

namespace PowerStakeBet.API.Models.Entities;

public class CustomMatch
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(64)]
    public string Sport { get; set; } = "football";

    [Required, MaxLength(120)]
    public string League { get; set; } = string.Empty;

    [MaxLength(120)]
    public string Country { get; set; } = string.Empty;

    [Required, MaxLength(120)]
    public string HomeTeam { get; set; } = string.Empty;

    [Required, MaxLength(120)]
    public string AwayTeam { get; set; } = string.Empty;

    public int? HomeScore { get; set; }
    public int? AwayScore { get; set; }

    [MaxLength(20)]
    public string? Minute { get; set; }

    [MaxLength(20)]
    public string? StartTime { get; set; }

    public DateTime? StartTimeUtc { get; set; }

    public bool IsLive { get; set; }

    public decimal OddsHome { get; set; }
    public decimal OddsDraw { get; set; }
    public decimal OddsAway { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
