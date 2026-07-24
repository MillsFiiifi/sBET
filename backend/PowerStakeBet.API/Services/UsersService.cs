using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PowerStakeBet.API.Configuration;
using PowerStakeBet.API.Data;
using PowerStakeBet.API.Models.Dtos;
using PowerStakeBet.API.Models.Entities;

namespace PowerStakeBet.API.Services;

public interface IUsersService
{
    Task<UserResponseDto> RegisterAsync(RegisterUserDto dto);
    Task<UserResponseDto?> LoginAsync(LoginDto dto);
    Task<UserResponseDto?> GetByIdAsync(Guid id);
    Task<DepositResponseDto?> DepositAsync(DepositDto dto);
    Task<DepositOutcome> WithdrawAsync(WithdrawDto dto);
}

public enum DepositOutcome { Success, NotFound, NoDeposit, InsufficientFunds }

public record WithdrawResult(DepositOutcome Outcome, UserResponseDto? User = null);

public class UsersService : IUsersService
{
    private readonly PowerStakeBetDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly BusinessSettings _business;

    public UsersService(PowerStakeBetDbContext db, IPasswordHasher hasher, IOptions<BusinessSettings> business)
    {
        _db = db;
        _hasher = hasher;
        _business = business.Value;
    }

    public async Task<UserResponseDto> RegisterAsync(RegisterUserDto dto)
    {
        var emailLower = dto.Email.Trim().ToLowerInvariant();

        var exists = await _db.Users.AnyAsync(u => u.Email == emailLower);
        if (exists) throw new InvalidOperationException("email already registered");

        SubAdmin? referrer = null;
        if (!string.IsNullOrWhiteSpace(dto.ReferralCode))
        {
            var code = dto.ReferralCode.Trim().ToUpperInvariant();
            referrer = await _db.SubAdmins.FirstOrDefaultAsync(s => s.ReferralCode == code);
        }

        var user = new User
        {
            Name = dto.Name.Trim(),
            Email = emailLower,
            PasswordHash = _hasher.Hash(dto.Password),
            ReferredByCode = referrer?.ReferralCode,
            ReferredBySubAdminId = referrer?.Id,
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return ToDto(user);
    }

    public async Task<UserResponseDto?> LoginAsync(LoginDto dto)
    {
        var emailLower = dto.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == emailLower);
        if (user is null) return null;
        if (!_hasher.Verify(dto.Password, user.PasswordHash)) return null;
        return ToDto(user);
    }

    public async Task<UserResponseDto?> GetByIdAsync(Guid id)
    {
        var user = await _db.Users.FindAsync(id);
        return user is null ? null : ToDto(user);
    }

    public async Task<DepositResponseDto?> DepositAsync(DepositDto dto)
    {
        var user = await _db.Users
            .Include(u => u.ReferredBySubAdmin)
            .FirstOrDefaultAsync(u => u.Id == dto.UserId);
        if (user is null) return null;

        var isFirst = user.FirstDepositAt is null;
        if (isFirst)
        {
            user.FirstDepositAmount = dto.Amount;
            user.FirstDepositAt = DateTime.UtcNow;
        }
        user.TotalDeposited = Math.Round(user.TotalDeposited + dto.Amount, 2);
        user.Balance = Math.Round(user.Balance + dto.Amount, 2);

        CommissionInfoDto? commissionInfo = null;
        if (isFirst && user.ReferredBySubAdmin is { Approved: true } sa)
        {
            var rate = _business.CommissionRate;
            var amount = Math.Round(dto.Amount * rate, 2);
            sa.CommissionBalance = Math.Round(sa.CommissionBalance + amount, 2);
            sa.TotalCommissionEarned = Math.Round(sa.TotalCommissionEarned + amount, 2);

            _db.Commissions.Add(new Commission
            {
                SubAdminId = sa.Id,
                UserId = user.Id,
                DepositAmount = dto.Amount,
                CommissionAmount = amount,
                Rate = rate,
            });

            commissionInfo = new CommissionInfoDto(amount, rate,
                new SubAdminSummaryDto(sa.Id, sa.Name, sa.ReferralCode));
        }

        await _db.SaveChangesAsync();
        return new DepositResponseDto(ToDto(user), isFirst, commissionInfo);
    }

    public async Task<DepositOutcome> WithdrawAsync(WithdrawDto dto)
    {
        var user = await _db.Users.FindAsync(dto.UserId);
        if (user is null) return DepositOutcome.NotFound;
        if (user.FirstDepositAt is null) return DepositOutcome.NoDeposit;
        if (dto.Amount > user.Balance) return DepositOutcome.InsufficientFunds;

        user.TotalWithdrawn = Math.Round(user.TotalWithdrawn + dto.Amount, 2);
        user.Balance = Math.Round(user.Balance - dto.Amount, 2);
        await _db.SaveChangesAsync();
        return DepositOutcome.Success;
    }

    public static UserResponseDto ToDto(User u) => new(
        u.Id, u.Name, u.Email,
        u.TotalDeposited, u.TotalWithdrawn, u.Balance,
        u.FirstDepositAt, u.CreatedAt);
}
