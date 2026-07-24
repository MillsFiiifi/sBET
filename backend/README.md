# PowerStakeBet.API — ASP.NET Core 8 backend

Backend for the PowerStakeBet sports-betting demo. Replaces the Next.js
file-based `/api/*` routes with a proper Web API backed by SQL Server.

## Stack

- ASP.NET Core 8 Web API
- EF Core 8 + SQL Server
- JWT bearer authentication
- BCrypt password hashing
- Swagger / OpenAPI at `/swagger`
- The Odds API integration for live matches

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- SQL Server (Express, Developer, or LocalDB — connection string assumes `.\SQLEXPRESS`)
- Optional: a free key from [the-odds-api.com](https://the-odds-api.com)

## First-time setup

```powershell
cd backend
dotnet restore
dotnet build
```

### 1. Edit `appsettings.json`

- **ConnectionStrings:Default** — change if your SQL Server instance isn't `.\SQLEXPRESS`. Examples:
  - SQL Server Express:  `Server=.\SQLEXPRESS;Database=PowerStakeBet;Trusted_Connection=True;TrustServerCertificate=True`
  - LocalDB:             `Server=(localdb)\MSSQLLocalDB;Database=PowerStakeBet;Trusted_Connection=True`
  - SQL Server default:  `Server=localhost;Database=PowerStakeBet;Trusted_Connection=True;TrustServerCertificate=True`
- **Jwt:Key** — replace the placeholder with a long random string (≥32 chars)
- **Admin:Password** — what `/api/admin/login` checks against
- **OddsApi:ApiKey** — paste your odds-api key (empty disables real-data fetch and the matches API returns mock)

### 2. Create the database

```powershell
cd PowerStakeBet.API
dotnet tool install --global dotnet-ef    # one-time, if you don't have it
dotnet ef migrations add InitialCreate
dotnet ef database update
```

The app also auto-applies migrations on startup, so step 3 below is enough
for subsequent runs.

### 3. Run

```powershell
dotnet run
```

Open <http://localhost:5050/swagger> — interactive API docs.
Open <http://localhost:5050/health> — basic health check.

## Endpoints

| Method | Path                                  | Auth        | Purpose                            |
| ------ | ------------------------------------- | ----------- | ---------------------------------- |
| POST   | /api/users/register                   | public      | Sign up a player                   |
| POST   | /api/users/login                      | public      | Email + password → JWT             |
| GET    | /api/users/{id}                       | public      | Read profile + balance             |
| POST   | /api/users/deposit                    | public      | Add funds, fires sub-admin commission on first deposit |
| POST   | /api/users/withdraw                   | public      | Withdraw against balance           |
| POST   | /api/bets                             | public      | Place a multi-selection bet        |
| GET    | /api/bets?userId=…&code=…             | public      | List or look up by code            |
| GET    | /api/bets/{id}                        | public      | Get one                            |
| PATCH  | /api/bets/{id}                        | admin       | Settle (won/lost) or revert        |
| DELETE | /api/bets/{id}                        | admin       | Remove                             |
| POST   | /api/sub-admin/register               | public      | Apply to become a partner          |
| POST   | /api/sub-admin/login                  | public      | Login (must be approved)           |
| GET    | /api/sub-admin/me                     | sub-admin   | Self profile                       |
| GET    | /api/sub-admin/me/commissions         | sub-admin   | My commission ledger               |
| POST   | /api/admin/login                      | public      | Password gate → admin JWT          |
| GET    | /api/admin/status                     | admin       | Token verification                 |
| GET    | /api/admin/stats                      | admin       | Counts + monetary totals           |
| GET    | /api/admin/sub-admins                 | admin       | List all sub-admins                |
| PATCH  | /api/admin/sub-admins/{id}            | admin       | Approve / unapprove                |
| DELETE | /api/admin/sub-admins/{id}            | admin       | Remove                             |
| GET    | /api/admin/custom-matches?sport=…     | admin       | Admin-created matches              |
| POST   | /api/admin/custom-matches             | admin       | Add a custom match                 |
| PUT    | /api/admin/custom-matches/{id}        | admin       | Edit                               |
| DELETE | /api/admin/custom-matches/{id}        | admin       | Remove                             |
| GET    | /api/matches?sport=football&today=1   | public      | Live + upcoming, today filter      |

Auth headers: `Authorization: Bearer <jwt>`

## Wiring the Next.js frontend

Set this in `.env.local` of the Next.js project, then redeploy:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5050   # or https://powerstakebet-api.example.com
```

Update frontend `fetch('/api/users/login', …)` calls to
`fetch(\`\${process.env.NEXT_PUBLIC_API_BASE_URL}/api/users/login\`, …)`.

The backend's `Cors:AllowedOrigins` already includes
`http://localhost:3000` and `https://powerstakebet-delta.vercel.app`.

## Project layout

```
backend/
  PowerStakeBet.sln
  PowerStakeBet.API/
    Program.cs                  ← startup, DI, JWT, CORS, Swagger, auto-migrate
    appsettings.json            ← connection string, JWT key, admin pwd, odds-api
    Configuration/AppSettings.cs
    Controllers/
      UsersController.cs
      BetsController.cs
      MatchesController.cs
      SubAdminsController.cs
      AdminController.cs
      CustomMatchesController.cs
    Data/PowerStakeBetDbContext.cs   ← EF Core context + model config
    Models/
      Entities/                 ← User, SubAdmin, Commission, Bet, BetSelection, CustomMatch
      Dtos/                     ← Request / response DTOs
    Services/
      PasswordHasher.cs         ← BCrypt
      JwtService.cs             ← issue tokens
      UsersService.cs           ← register/login/deposit/withdraw + commission
      BetsService.cs            ← place / list / settle
      SubAdminsService.cs       ← referral codes, approval, commissions
      CustomMatchesService.cs   ← admin-added matches
      OddsApiService.cs         ← the-odds-api.com client
```

## Production notes

- Move `Jwt:Key`, `Admin:Password`, `OddsApi:ApiKey`, and the DB password
  out of `appsettings.json`. Use **user secrets** locally and env vars in
  production (`ASPNETCORE_Jwt__Key`, `ASPNETCORE_ConnectionStrings__Default`, …).
- For Azure: use Azure SQL + Azure App Service or Container Apps.
- The auto-migrate on startup is convenient for demos but a real
  deployment should run `dotnet ef database update` as a separate
  release step.
