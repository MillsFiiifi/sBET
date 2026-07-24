using System.ComponentModel.DataAnnotations;

namespace PowerStakeBet.API.Models.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    [MaxLength(32)]
    public string? ReferredByCode { get; set; }

    public Guid? ReferredBySubAdminId { get; set; }
    public SubAdmin? ReferredBySubAdmin { get; set; }

    public decimal FirstDepositAmount { get; set; }
    public DateTime? FirstDepositAt { get; set; }
    public decimal TotalDeposited { get; set; }
    public decimal TotalWithdrawn { get; set; }
    public decimal Balance { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Bet> Bets { get; set; } = new List<Bet>();
}
