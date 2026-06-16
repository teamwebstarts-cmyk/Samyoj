# ============================================================
#  start-all.ps1 — WhatsApp Platform one-shot local starter
#  Run this AFTER Docker Desktop is installed and running.
#
#  Usage (from D:\whatsapp):
#     powershell -ExecutionPolicy Bypass -File .\start-all.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "  [ERR] $msg" -ForegroundColor Red }

# ---- 1. Docker check ----
Step "Checking Docker"
try {
    $ver = docker --version
    Ok "Docker found: $ver"
} catch {
    Err "Docker not installed or not in PATH."
    Err "Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    Err "Then restart PowerShell and run this script again."
    exit 1
}

# ---- 2. Start Postgres + Redis ----
Step "Starting Postgres + Redis (docker compose up -d)"
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Err "docker compose up failed. Check 'docker compose logs' for details."
    exit 1
}
Ok "Containers started"

# ---- 3. Wait for healthchecks ----
Step "Waiting for services to be healthy"
$attempts = 0
$maxAttempts = 30
$pgReady = $false
$redisReady = $false
while ($attempts -lt $maxAttempts -and (-not $pgReady -or -not $redisReady)) {
    $attempts++
    Start-Sleep -Seconds 2
    $pg = docker inspect --format='{{.State.Health.Status}}' whatsapp_postgres 2>$null
    $rd = docker inspect --format='{{.State.Health.Status}}' whatsapp_redis 2>$null
    if ($pg -eq 'healthy') { $pgReady = $true }
    if ($rd -eq 'healthy') { $redisReady = $true }
    Write-Host "  attempt $attempts/$maxAttempts — pg=$pg, redis=$rd"
}
if (-not $pgReady -or -not $redisReady) {
    Err "Services did not become healthy in time. Run 'docker compose ps' to inspect."
    exit 1
}
Ok "Postgres healthy"
Ok "Redis healthy"

# ---- 4. Prisma push ----
Step "Pushing Prisma schema to database"
Set-Location "$root\server"
npm run db:push
if ($LASTEXITCODE -ne 0) { Err "db:push failed"; exit 1 }
npm run db:generate
if ($LASTEXITCODE -ne 0) { Err "db:generate failed"; exit 1 }
Ok "Database ready"
Set-Location $root

# ---- 5. Start dev ----
Step "Starting dev servers (frontend: 5173, backend: 5000)"
Write-Host "  Open http://localhost:5173 in your browser." -ForegroundColor Green
Write-Host "  Press Ctrl+C in this window to stop.`n" -ForegroundColor Yellow
npm run dev
