<#
.SYNOPSIS
  Generates an SBET promo video with FFmpeg using the "Earthly Richness"
  brand palette (Deep Green -> Brown gradient, Gold & Cream text).

.DESCRIPTION
  Produces a ~15s 1920x1080 MP4 with three animated, cross-faded title cards.
  Pure FFmpeg — no source footage required (background is generated).

.EXAMPLE
  pwsh ./scripts/make-promo.ps1
  pwsh ./scripts/make-promo.ps1 -Out public/sbet-promo.mp4 -FontFile C:/Windows/Fonts/georgiab.ttf
#>
param(
  [string]$Out       = "public/sbet-promo.mp4",
  [int]   $Width     = 1920,
  [int]   $Height    = 1080,
  [int]   $Fps       = 30,
  # A wealthy serif reads best. Georgia Bold ships with Windows; override to
  # use the brand's Cinzel .ttf if you have it locally.
  [string]$FontFile  = "C:/Windows/Fonts/georgiab.ttf"
)

$ErrorActionPreference = "Stop"

# --- preflight ---------------------------------------------------------------
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Error "ffmpeg not found on PATH. Install it (e.g. 'choco install ffmpeg' or 'winget install Gyan.FFmpeg') and re-run."
  exit 1
}
if (-not (Test-Path $FontFile)) {
  Write-Error "Font file not found: $FontFile. Pass -FontFile <path-to-.ttf>."
  exit 1
}

$outDir = Split-Path -Parent $Out
if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Force $outDir | Out-Null }

# --- brand palette (Earthly Richness) ---------------------------------------
$Gold   = "0xC9A227"
$Cream  = "0xF3EAD3"
$Green0 = "0x14361F"   # deep green  (gradient start)
$Brown1 = "0x2B1F12"   # dark brown  (gradient end)

# ffmpeg filtergraph needs ':' inside a Windows path escaped as '\:'
$font = ($FontFile -replace '\\','/') -replace ':','\:'

# alpha ramp for a card shown between $s..$e seconds with a $f second fade
function FadeAlpha([double]$s, [double]$e, [double]$f = 0.6) {
  "if(lt(t,$s),0,if(lt(t,$s+$f),(t-$s)/$f,if(lt(t,$e-$f),1,if(lt(t,$e),($e-t)/$f,0))))"
}

function Card([string]$text, [string]$color, [int]$size, [string]$yExpr, [double]$s, [double]$e) {
  $a = FadeAlpha $s $e
  "drawtext=fontfile='$font':text='$text':fontcolor=$color:fontsize=$size:" +
  "x=(w-text_w)/2:y=$yExpr:alpha='$a':shadowcolor=0x000000@0.5:shadowx=2:shadowy=3"
}

$dur = 15

# Deep-green -> brown diagonal gradient as the base layer.
$bg = "gradients=s=${Width}x${Height}:c0=$Green0:c1=$Brown1:x0=0:y0=0:x1=$Width:y1=$Height:d=${dur}:speed=0.01,format=yuv420p"

# thin gold rule under the wordmark on card 1
$rule = "drawbox=x=(iw-360)/2:y=ih/2+40:w=360:h=3:color=$Gold@0.9:t=fill:enable='between(t,0.6,4.6)'"

$cards = @(
  (Card "S B E T"                    $Gold  180 "(h/2)-140" 0   5),
  (Card "Bet Rich.  Bet Smart."      $Cream  60 "(h/2)+70"  0.4 5),
  (Card "LIVE ODDS - REAL MATCHES"   $Gold   96 "(h-text_h)/2" 5 10),
  (Card "Where Wealth Meets The Game" $Cream  84 "(h/2)-60" 10 15),
  (Card "sbet"                       $Gold   56 "(h/2)+80" 10.4 15)
) -join ","

$vf = "$bg,$rule,$cards"

Write-Host "Rendering promo -> $Out ..." -ForegroundColor Green
ffmpeg -y -f lavfi -i "color=c=$Brown1:s=${Width}x${Height}:d=$dur:r=$Fps" `
  -vf $vf `
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart `
  -t $dur $Out

if ($LASTEXITCODE -eq 0) {
  Write-Host "Done: $Out" -ForegroundColor Green
} else {
  Write-Error "ffmpeg exited with code $LASTEXITCODE"
}
