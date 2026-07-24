using System.ComponentModel.DataAnnotations;

namespace PowerStakeBet.API.Models.Dtos;

public record RegisterUserDto(
    [Required, MinLength(2), MaxLength(120)] string Name,
    [Required, EmailAddress] string Email,
    [Required, MinLength(6)] string Password,
    string? ReferralCode
);

public record LoginDto(
    [Required, EmailAddress] string Email,
    [Required] string Password
);

public record DepositDto(
    [Required] Guid UserId,
    [Range(0.01, double.MaxValue)] decimal Amount
);

public record WithdrawDto(
    [Required] Guid UserId,
    [Range(0.01, double.MaxValue)] decimal Amount
);

public record UserResponseDto(
    Guid Id,
    string Name,
    string Email,
    decimal TotalDeposited,
    decimal TotalWithdrawn,
    decimal Balance,
    DateTime? FirstDepositAt,
    DateTime CreatedAt
);

public record AuthResponseDto(
    string Token,
    DateTime ExpiresAt,
    UserResponseDto User
);

public record DepositResponseDto(
    UserResponseDto User,
    bool IsFirstDeposit,
    CommissionInfoDto? Commission
);

public record CommissionInfoDto(
    decimal Amount,
    decimal Rate,
    SubAdminSummaryDto? SubAdmin
);

public record SubAdminSummaryDto(Guid Id, string Name, string ReferralCode);
