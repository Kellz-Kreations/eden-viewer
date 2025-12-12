param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

function Write-Info([string]$Message) { Write-Host "[INFO] $Message" }
function Write-Warn([string]$Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Err([string]$Message)  { Write-Host "[FAIL] $Message" -ForegroundColor Red }

$failures = New-Object System.Collections.Generic.List[string]

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) {
    $failures.Add($Message) | Out-Null
    Write-Err $Message
  } else {
    Write-Info $Message
  }
}

Write-Info "Project root: $ProjectRoot"

$requiredFiles = @(
  'compose.yaml',
  '.env.example',
  'README.md',
  'docs/synology-setup.md',
  '.github/copilot-instructions.md'
)

foreach ($relative in $requiredFiles) {
  $path = Join-Path $ProjectRoot $relative
  Assert-True (Test-Path $path) "Exists: $relative"
}

$envExamplePath = Join-Path $ProjectRoot '.env.example'
$composePath    = Join-Path $ProjectRoot 'compose.yaml'

# Basic env example validation
$envText = Get-Content -Path $envExamplePath -Raw
$requiredEnvKeys = @('APPDATA_ROOT','DATA_ROOT','TRANSCODE_ROOT','PUID','PGID','TZ')
foreach ($key in $requiredEnvKeys) {
  Assert-True ($envText -match "(?m)^\s*$key=") "Env var defined in .env.example: $key"
}

# Compose sanity checks (string-based)
$composeText = Get-Content -Path $composePath -Raw

# Ensure only the intended services are present
$serviceNames = @('setup-ui','plex','sonarr','radarr')
foreach ($svc in $serviceNames) {
  Assert-True ($composeText -match "(?m)^\s+${svc}:\s*$") "Compose defines service: $svc"
}

# Guardrail: ensure we didn't accidentally add disallowed apps
$disallowed = @('qbittorrent','sabnzbd','prowlarr','jackett','deluge','transmission')
foreach ($name in $disallowed) {
  Assert-True (-not ($composeText -match "(?i)$name")) "No disallowed service/reference present: $name"
}

# Validate referenced env vars are present in .env.example
$varMatches = [regex]::Matches($composeText, "\$\{([A-Za-z0-9_]+)")
$vars = $varMatches | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique

$missingVars = @()
foreach ($v in $vars) {
  if (-not ($envText -match "(?m)^\s*$([regex]::Escape($v))=")) {
    # allow compose 'name' fields etc. to reference nothing; only env vars here
    $missingVars += $v
  }
}

if ($missingVars.Count -gt 0) {
  foreach ($mv in $missingVars) { Write-Err "Compose references env var not present in .env.example: $mv" }
  $failures.Add("Missing env vars in .env.example") | Out-Null
} else {
  Write-Info "All compose env vars are present in .env.example"
}

# Optional: validate compose schema via docker compose config
$dockerExe = $null
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerCmd) {
  $dockerExe = $dockerCmd.Source
} elseif (Test-Path "C:\Program Files\Docker\Docker\resources\bin\docker.exe") {
  $dockerExe = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
}

if ($dockerExe) {
  try {
    $dockerBin = Split-Path -Parent $dockerExe
    if ($dockerBin -and ($env:PATH -notlike "*$dockerBin*")) {
      $env:PATH = "$dockerBin;$env:PATH"
    }

    Write-Info "Running: docker compose --env-file .env.example config"
    Push-Location $ProjectRoot
    & $dockerExe compose --env-file .env.example config | Out-Null
    Pop-Location
    Write-Info "docker compose config: OK"
  } catch {
    $failures.Add("docker compose config failed") | Out-Null
    Write-Err "docker compose config failed: $($_.Exception.Message)"
  }
} else {
  Write-Warn "Docker CLI not found (docker.exe not on PATH and Docker Desktop not detected); skipped compose validation."
}

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Err ("Smoke test failed with {0} issue(s)." -f $failures.Count)
  exit 1
}

Write-Host ""
Write-Info "Smoke test passed."
exit 0
