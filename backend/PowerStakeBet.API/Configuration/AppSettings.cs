namespace PowerStakeBet.API.Configuration;

public class JwtSettings
{
    public string Issuer { get; set; } = "PowerStakeBet.API";
    public string Audience { get; set; } = "PowerStakeBet.Frontend";
    public string Key { get; set; } = string.Empty;
    public int ExpiryHours { get; set; } = 72;
}

public class AdminSettings
{
    public string Password { get; set; } = string.Empty;
}

public class OddsApiSettings
{
    public string BaseUrl { get; set; } = "https://api.the-odds-api.com/v4";
    public string ApiKey { get; set; } = string.Empty;
}

public class BusinessSettings
{
    public decimal CommissionRate { get; set; } = 0.6m;
}

public class CorsSettings
{
    public string[] AllowedOrigins { get; set; } = Array.Empty<string>();
}
