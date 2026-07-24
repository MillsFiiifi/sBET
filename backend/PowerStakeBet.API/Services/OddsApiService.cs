using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using PowerStakeBet.API.Configuration;

namespace PowerStakeBet.API.Services;

public interface IOddsApiService
{
    Task<MatchesResponse> GetMatchesAsync(string sport, bool todayOnly, int tzOffsetMinutes);
}

public record MatchesResponse(string Source, string? Reason, List<MatchDto> Matches);

public record MatchDto(
    string Id,
    string League,
    string Country,
    string HomeTeam,
    string AwayTeam,
    bool IsLive,
    string? StartTime,
    string? StartTimeIso,
    string? Minute,
    OddsTriplet Odds,
    string Sport
);

public record OddsTriplet(decimal Home, decimal Draw, decimal Away);

public class OddsApiService : IOddsApiService
{
    private static readonly Dictionary<string, string[]> SportKeys = new()
    {
        ["football"] = new[]
        {
            "soccer_epl","soccer_spain_la_liga","soccer_italy_serie_a","soccer_germany_bundesliga",
            "soccer_france_ligue_one","soccer_netherlands_eredivisie","soccer_portugal_primeira_liga",
            "soccer_belgium_first_div","soccer_turkey_super_league","soccer_uefa_champs_league",
            "soccer_uefa_europa_league","soccer_usa_mls","soccer_mexico_ligamx",
            "soccer_brazil_campeonato","soccer_argentina_primera_division","soccer_japan_j_league",
            "soccer_korea_kleague1","soccer_australia_aleague","soccer_efl_champ","soccer_spl",
        },
        ["basketball"] = new[] { "basketball_nba", "basketball_euroleague" },
        ["tennis"] = new[] { "tennis_atp_aus_open_singles", "tennis_wta_aus_open_singles" },
        ["baseball"] = new[] { "baseball_mlb" },
        ["hockey"] = new[] { "icehockey_nhl" },
    };

    private static readonly Dictionary<string, string> TitleToCountry = new()
    {
        ["EPL"] = "England",
        ["La Liga - Spain"] = "Spain",
        ["Serie A - Italy"] = "Italy",
        ["Bundesliga - Germany"] = "Germany",
        ["Ligue 1 - France"] = "France",
        ["Eredivisie - Netherlands"] = "Netherlands",
        ["UEFA Champions League"] = "Europe",
        ["UEFA Europa League"] = "Europe",
        ["MLS - USA"] = "USA",
        ["Liga MX - Mexico"] = "Mexico",
        ["Brazil Série A"] = "Brazil",
        ["NBA"] = "USA",
        ["NHL"] = "USA",
        ["MLB"] = "USA",
    };

    private readonly HttpClient _http;
    private readonly OddsApiSettings _settings;
    private readonly ILogger<OddsApiService> _log;

    public OddsApiService(HttpClient http, IOptions<OddsApiSettings> options, ILogger<OddsApiService> log)
    {
        _http = http;
        _settings = options.Value;
        _log = log;
    }

    public async Task<MatchesResponse> GetMatchesAsync(string sport, bool todayOnly, int tzOffsetMinutes)
    {
        if (string.IsNullOrEmpty(_settings.ApiKey))
            return new MatchesResponse("mock", "ODDS_API_KEY not configured", new List<MatchDto>());

        var keys = SportKeys.GetValueOrDefault(sport.ToLowerInvariant()) ?? Array.Empty<string>();
        if (keys.Length == 0)
            return new MatchesResponse("mock", "unsupported sport", new List<MatchDto>());

        var matches = new List<MatchDto>();
        var tasks = keys.Select(k => FetchSportAsync(k, sport)).ToList();
        await Task.WhenAll(tasks);
        foreach (var t in tasks)
        {
            if (t.IsCompletedSuccessfully && t.Result is { } list) matches.AddRange(list);
        }

        if (matches.Count == 0)
            return new MatchesResponse("mock", "no events returned", new List<MatchDto>());

        if (todayOnly) matches = matches.Where(m => m.IsLive || IsToday(m.StartTimeIso, tzOffsetMinutes)).ToList();

        matches = matches.OrderBy(m => m.IsLive ? 0 : 1).ThenBy(m => m.StartTimeIso).ToList();
        return new MatchesResponse("odds-api", null, matches);
    }

    private async Task<List<MatchDto>?> FetchSportAsync(string sportKey, string sport)
    {
        try
        {
            var url = $"{_settings.BaseUrl}/sports/{sportKey}/odds/?apiKey={_settings.ApiKey}&regions=eu&markets=h2h&oddsFormat=decimal";
            var res = await _http.GetAsync(url);
            if (!res.IsSuccessStatusCode) return new List<MatchDto>();
            var json = await res.Content.ReadAsStringAsync();
            var events = JsonSerializer.Deserialize<List<OddsApiEvent>>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            }) ?? new();
            return events.Select(e => ToMatch(e, sport)).Where(m => m.Odds.Home > 0 && m.Odds.Away > 0).ToList();
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Odds API fetch failed for {SportKey}", sportKey);
            return new List<MatchDto>();
        }
    }

    private static MatchDto ToMatch(OddsApiEvent e, string sport)
    {
        var start = e.CommenceTime;
        var isLive = start < DateTime.UtcNow;
        var odds = AverageH2H(e);
        return new MatchDto(
            e.Id,
            e.SportTitle,
            TitleToCountry.GetValueOrDefault(e.SportTitle, "International"),
            e.HomeTeam,
            e.AwayTeam,
            isLive,
            isLive ? null : start.ToString("HH:mm"),
            start.ToString("o"),
            isLive ? $"{(int)(DateTime.UtcNow - start).TotalMinutes}'" : null,
            odds,
            sport
        );
    }

    private static OddsTriplet AverageH2H(OddsApiEvent e)
    {
        decimal homeSum = 0, drawSum = 0, awaySum = 0;
        int homeN = 0, drawN = 0, awayN = 0;
        foreach (var bm in e.Bookmakers)
        {
            var market = bm.Markets.FirstOrDefault(m => m.Key == "h2h");
            if (market is null) continue;
            foreach (var o in market.Outcomes)
            {
                if (o.Name == e.HomeTeam) { homeSum += o.Price; homeN++; }
                else if (o.Name == e.AwayTeam) { awaySum += o.Price; awayN++; }
                else if (string.Equals(o.Name, "draw", StringComparison.OrdinalIgnoreCase))
                { drawSum += o.Price; drawN++; }
            }
        }
        return new OddsTriplet(
            homeN > 0 ? Math.Round(homeSum / homeN, 2) : 0,
            drawN > 0 ? Math.Round(drawSum / drawN, 2) : 0,
            awayN > 0 ? Math.Round(awaySum / awayN, 2) : 0
        );
    }

    private static bool IsToday(string? iso, int tzOffsetMinutes)
    {
        if (string.IsNullOrEmpty(iso)) return true;
        if (!DateTime.TryParse(iso, out var t)) return true;
        var local = t.AddMinutes(-tzOffsetMinutes);
        var nowLocal = DateTime.UtcNow.AddMinutes(-tzOffsetMinutes);
        return local.Date == nowLocal.Date;
    }

    private class OddsApiEvent
    {
        [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
        [JsonPropertyName("sport_key")] public string SportKey { get; set; } = string.Empty;
        [JsonPropertyName("sport_title")] public string SportTitle { get; set; } = string.Empty;
        [JsonPropertyName("commence_time")] public DateTime CommenceTime { get; set; }
        [JsonPropertyName("home_team")] public string HomeTeam { get; set; } = string.Empty;
        [JsonPropertyName("away_team")] public string AwayTeam { get; set; } = string.Empty;
        [JsonPropertyName("bookmakers")] public List<OddsApiBookmaker> Bookmakers { get; set; } = new();
    }

    private class OddsApiBookmaker
    {
        [JsonPropertyName("key")] public string Key { get; set; } = string.Empty;
        [JsonPropertyName("markets")] public List<OddsApiMarket> Markets { get; set; } = new();
    }

    private class OddsApiMarket
    {
        [JsonPropertyName("key")] public string Key { get; set; } = string.Empty;
        [JsonPropertyName("outcomes")] public List<OddsApiOutcome> Outcomes { get; set; } = new();
    }

    private class OddsApiOutcome
    {
        [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;
        [JsonPropertyName("price")] public decimal Price { get; set; }
    }
}
