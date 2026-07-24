using System.ComponentModel.DataAnnotations;

namespace PowerStakeBet.API.Models.Dtos;

public record RegisterSubAdminDto(
    [Required, MinLength(2), MaxLength(120)] string Name,
    [Required, EmailAddress] string Email,
    [Required, MinLength(6)] string Password
);

public record SubAdminResponseDto(
    Guid Id,
    string Name,
    string Email,
    string ReferralCode,
    bool Approved,
    decimal CommissionBalance,
    decimal TotalCommissionEarned,
    DateTime CreatedAt
);

public record SubAdminAuthResponseDto(
    string Token,
    DateTime ExpiresAt,
    SubAdminResponseDto SubAdmin
);

public record ApproveSubAdminDto([Required] bool Approved);

public record CommissionListItemDto(
    Guid Id,
    Guid UserId,
    decimal DepositAmount,
    decimal CommissionAmount,
    decimal Rate,
    DateTime CreatedAt
);
