using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using PowerStakeBet.API.Configuration;

namespace PowerStakeBet.API.Services;

public interface IJwtService
{
    (string token, DateTime expiresAt) Issue(string subject, string role, IEnumerable<Claim>? extra = null);
}

public class JwtService : IJwtService
{
    private readonly JwtSettings _settings;

    public JwtService(IOptions<JwtSettings> options)
    {
        _settings = options.Value;
    }

    public (string token, DateTime expiresAt) Issue(string subject, string role, IEnumerable<Claim>? extra = null)
    {
        var expires = DateTime.UtcNow.AddHours(_settings.ExpiryHours);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, subject),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.Role, role),
        };
        if (extra is not null) claims.AddRange(extra);

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var jwt = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            expires: expires,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(jwt), expires);
    }
}
