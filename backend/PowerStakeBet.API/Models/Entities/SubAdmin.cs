using System.ComponentModel.DataAnnotations;

namespace PowerStakeBet.API.Models.Entities;

public class SubAdmin
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    [Required, MaxLength(16)]
    public string ReferralCode { get; set; } = string.Empty;

    public bool Approved { get; set; }
    public decimal CommissionBalance { get; set; }
    public decimal TotalCommissionEarned { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<User> ReferredUsers { get; set; } = new List<User>();
    public ICollection<Commission> Commissions { get; set; } = new List<Commission>();
}

public class Commission
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid SubAdminId { get; set; }
    public SubAdmin SubAdmin { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public decimal DepositAmount { get; set; }
    public decimal CommissionAmount { get; set; }
    public decimal Rate { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
