using Microsoft.EntityFrameworkCore;
using PowerStakeBet.API.Data;
using PowerStakeBet.API.Models.Dtos;
using PowerStakeBet.API.Models.Entities;
using System.Security.Cryptography;

namespace PowerStakeBet.API.Services;

public interface ISubAdminsService
{
    Task<SubAdminResponseDto> RegisterAsync(RegisterSubAdminDto dto);
    Task<SubAdminResponseDto?> LoginAsync(LoginDto dto);
    Task<SubAdminResponseDto?> GetByIdAsync(Guid id);
    Task<List<SubAdminResponseDto>> ListAsync();
    Task<SubAdminResponseDto?> SetApprovedAsync(Guid id, bool approved);
    Task<bool> DeleteAsync(Guid id);
    Task<List<CommissionListItemDto>> ListCommissionsAsync(Guid subAdminId);
}

public class SubAdminsService : ISubAdminsService
{
    private const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private readonly PowerStakeBetDbContext _db;
    private readonly IPasswordHasher _hasher;

    public SubAdminsService(PowerStakeBetDbContext db, IPasswordHasher hasher)
    {
        _db = db;
        _hasher = hasher;
    }

    public async Task<SubAdminResponseDto> RegisterAsync(RegisterSubAdminDto dto)
    {
        var emailLower = dto.Email.Trim().ToLowerInvariant();
        var exists = await _db.SubAdmins.AnyAsync(s => s.Email == emailLower);
        if (exists) throw new InvalidOperationException("email already registered");

        var sa = new SubAdmin
        {
            Name = dto.Name.Trim(),
            Email = emailLower,
            PasswordHash = _hasher.Hash(dto.Password),
            ReferralCode = await GenerateUniqueReferralCodeAsync(),
            Approved = false,
        };
        _db.SubAdmins.Add(sa);
        await _db.SaveChangesAsync();
        return ToDto(sa);
    }

    public async Task<SubAdminResponseDto?> LoginAsync(LoginDto dto)
    {
        var emailLower = dto.Email.Trim().ToLowerInvariant();
        var sa = await _db.SubAdmins.FirstOrDefaultAsync(s => s.Email == emailLower);
        if (sa is null) return null;
        if (!_hasher.Verify(dto.Password, sa.PasswordHash)) return null;
        return ToDto(sa);
    }

    public async Task<SubAdminResponseDto?> GetByIdAsync(Guid id)
    {
        var sa = await _db.SubAdmins.FindAsync(id);
        return sa is null ? null : ToDto(sa);
    }

    public async Task<List<SubAdminResponseDto>> ListAsync()
    {
        return await _db.SubAdmins
            .AsNoTracking()
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new SubAdminResponseDto(
                s.Id, s.Name, s.Email, s.ReferralCode, s.Approved,
                s.CommissionBalance, s.TotalCommissionEarned, s.CreatedAt))
            .ToListAsync();
    }

    public async Task<SubAdminResponseDto?> SetApprovedAsync(Guid id, bool approved)
    {
        var sa = await _db.SubAdmins.FindAsync(id);
        if (sa is null) return null;
        sa.Approved = approved;
        await _db.SaveChangesAsync();
        return ToDto(sa);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var sa = await _db.SubAdmins.FindAsync(id);
        if (sa is null) return false;
        _db.SubAdmins.Remove(sa);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<List<CommissionListItemDto>> ListCommissionsAsync(Guid subAdminId)
    {
        return await _db.Commissions
            .AsNoTracking()
            .Where(c => c.SubAdminId == subAdminId)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new CommissionListItemDto(
                c.Id, c.UserId, c.DepositAmount, c.CommissionAmount, c.Rate, c.CreatedAt))
            .ToListAsync();
    }

    private async Task<string> GenerateUniqueReferralCodeAsync()
    {
        for (var i = 0; i < 20; i++)
        {
            var c = NewCode(6);
            if (!await _db.SubAdmins.AnyAsync(s => s.ReferralCode == c)) return c;
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

    private static SubAdminResponseDto ToDto(SubAdmin s) => new(
        s.Id, s.Name, s.Email, s.ReferralCode, s.Approved,
        s.CommissionBalance, s.TotalCommissionEarned, s.CreatedAt);
}
