using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using PowerStakeBet.API.Configuration;
using PowerStakeBet.API.Data;
using PowerStakeBet.API.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Configuration ─────────────────────────────────────────────────────────────
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<AdminSettings>(builder.Configuration.GetSection("Admin"));
builder.Services.Configure<OddsApiSettings>(builder.Configuration.GetSection("OddsApi"));
builder.Services.Configure<BusinessSettings>(builder.Configuration.GetSection("Business"));
builder.Services.Configure<CorsSettings>(builder.Configuration.GetSection("Cors"));

var jwt = builder.Configuration.GetSection("Jwt").Get<JwtSettings>() ?? new JwtSettings();
var cors = builder.Configuration.GetSection("Cors").Get<CorsSettings>() ?? new CorsSettings();

// ── EF Core + SQL Server ──────────────────────────────────────────────────────
builder.Services.AddDbContext<PowerStakeBetDbContext>(opts =>
    opts.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

// ── Services (DI) ─────────────────────────────────────────────────────────────
builder.Services.AddSingleton<IPasswordHasher, BcryptPasswordHasher>();
builder.Services.AddSingleton<IJwtService, JwtService>();
builder.Services.AddScoped<IUsersService, UsersService>();
builder.Services.AddScoped<IBetsService, BetsService>();
builder.Services.AddScoped<ISubAdminsService, SubAdminsService>();
builder.Services.AddScoped<ICustomMatchesService, CustomMatchesService>();
builder.Services.AddHttpClient<IOddsApiService, OddsApiService>(c =>
{
    c.Timeout = TimeSpan.FromSeconds(15);
});

// ── Authentication (JWT) ──────────────────────────────────────────────────────
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });
builder.Services.AddAuthorization();

// ── CORS ──────────────────────────────────────────────────────────────────────
const string CorsPolicy = "Frontend";
builder.Services.AddCors(o => o.AddPolicy(CorsPolicy, p =>
{
    if (cors.AllowedOrigins.Length > 0)
        p.WithOrigins(cors.AllowedOrigins).AllowAnyMethod().AllowAnyHeader().AllowCredentials();
    else
        p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
}));

// ── Controllers + Swagger ─────────────────────────────────────────────────────
builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    o.JsonSerializerOptions.DefaultIgnoreCondition =
        System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "PowerStakeBet API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" },
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// ── Auto-apply migrations on startup (demo convenience) ───────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PowerStakeBetDbContext>();
    try
    {
        db.Database.Migrate();
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Database migration failed on startup");
    }
}

// ── Pipeline ──────────────────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors(CorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => Results.Ok(new { name = "PowerStakeBet API", version = "1.0", docs = "/swagger" }));
app.MapGet("/health", () => Results.Ok(new { status = "ok", time = DateTime.UtcNow }));

app.MapControllers();

app.Run();
