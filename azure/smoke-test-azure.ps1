param(
  [string]$ResourceGroup = 'mediastack-rg',
  [int]$HttpTimeoutSeconds = 20,
  [switch]$SkipHttpChecks
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

function Test-AzAvailable {
  $az = Get-Command az -ErrorAction SilentlyContinue
  return [bool]$az
}

function Test-AzLoggedIn {
  try {
    az account show -o none | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Get-ContainerAppInfo {
  param(
    [Parameter(Mandatory=$true)][string]$Name
  )

  $json = az containerapp show -g $ResourceGroup -n $Name -o json 2>$null
  if (-not $json) { return $null }

  $app = $json | ConvertFrom-Json
  return [pscustomobject]@{
    Name              = $app.name
    ProvisioningState = $app.properties.provisioningState
    RunningStatus     = $app.properties.runningStatus
    Fqdn              = $app.properties.configuration.ingress.fqdn
    TargetPort        = $app.properties.configuration.ingress.targetPort
  }
}

function Get-HttpStatus {
  param(
    [Parameter(Mandatory=$true)][string]$Url
  )

  try {
    $resp = Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec $HttpTimeoutSeconds -MaximumRedirection 0 -ErrorAction Stop
    return [pscustomobject]@{ Url = $Url; StatusCode = [int]$resp.StatusCode; Error = $null }
  } catch {
    $status = $null
    $err = $_.Exception.Message

    # Try to extract HTTP status code from the response object (differs between PS 5/7)
    $respObj = $_.Exception.Response
    if ($respObj) {
      try { $status = [int]$respObj.StatusCode } catch {}
      if (-not $status) {
        try { $status = [int]$respObj.StatusCode.value__ } catch {}
      }
    }

    return [pscustomobject]@{ Url = $Url; StatusCode = $status; Error = $err }
  }
}

Write-Info "Azure smoke test (resource group: $ResourceGroup)"

Assert-True (Test-AzAvailable) "Azure CLI installed"
if ($failures.Count -gt 0) { exit 1 }

Assert-True (Test-AzLoggedIn) "Azure CLI authenticated (az login)"
if ($failures.Count -gt 0) {
  Write-Host ""; Write-Warn "Run: az login"; exit 1
}

# Bicep compilation (local)
try {
  $bicepPath = Join-Path $PSScriptRoot 'main.bicep'
  az bicep build --file $bicepPath --stdout > $null
  Write-Info "Bicep compiles: azure/main.bicep"
} catch {
  $failures.Add('Bicep compilation failed') | Out-Null
  Write-Err "Bicep compilation failed: $($_.Exception.Message)"
}

# Template validation (management plane, no changes)
try {
  $paramsPath = Join-Path $PSScriptRoot 'parameters.json'
  az deployment group validate --resource-group $ResourceGroup --template-file $bicepPath --parameters $paramsPath -o none
  Write-Info "Deployment validates: azure/main.bicep + azure/parameters.json"
} catch {
  $failures.Add('Deployment validation failed') | Out-Null
  Write-Err "Deployment validation failed: $($_.Exception.Message)"
}

# Verify resources actually exist (otherwise we can't do an end-to-end test)
$resourceCount = 0
try {
  $resourceCount = (az resource list -g $ResourceGroup -o json | ConvertFrom-Json).Count
} catch {
  $resourceCount = 0
}

Assert-True ($resourceCount -gt 0) "Resource group contains deployed resources"
if ($resourceCount -eq 0) {
  Write-Warn "No Azure resources found in '$ResourceGroup'. Deploy first (incurs cost):"
  Write-Warn "  cd azure; ./deploy.sh"
  Write-Warn "Then re-run: pwsh -NoProfile -File .\\azure\\smoke-test-azure.ps1"
}

if ($resourceCount -gt 0) {
  $apps = @('plex','sonarr','radarr')
  foreach ($name in $apps) {
    $info = Get-ContainerAppInfo -Name $name
    Assert-True ($null -ne $info) "Container App exists: $name"
    if ($info) {
      Assert-True ($info.ProvisioningState -eq 'Succeeded') "${name}: provisioningState == Succeeded"
      Assert-True ($info.RunningStatus -eq 'Running') "${name}: runningStatus == Running"
      Assert-True (-not [string]::IsNullOrWhiteSpace($info.Fqdn)) "${name}: ingress FQDN present"
    }
  }

  if (-not $SkipHttpChecks) {
    $plex = Get-ContainerAppInfo -Name 'plex'
    $sonarr = Get-ContainerAppInfo -Name 'sonarr'
    $radarr = Get-ContainerAppInfo -Name 'radarr'

    $urls = @()
    if ($plex -and $plex.Fqdn) { $urls += "https://$($plex.Fqdn)/web" }
    if ($sonarr -and $sonarr.Fqdn) { $urls += "https://$($sonarr.Fqdn)" }
    if ($radarr -and $radarr.Fqdn) { $urls += "https://$($radarr.Fqdn)" }

    foreach ($url in $urls) {
      $result = Get-HttpStatus -Url $url
      $code = $result.StatusCode

      # "Reachable" definition: any HTTP response we can get back is acceptable here, including auth redirects.
      $ok = ($code -in @(200,301,302,307,308,401,403))
      if ($ok) {
        Write-Info "HTTP reachable: $url (status $code)"
      } else {
        $msg = if ($code) { "HTTP unexpected: $url (status $code)" } else { "HTTP failed: $url ($($result.Error))" }
        $failures.Add($msg) | Out-Null
        Write-Err $msg
      }
    }
  } else {
    Write-Warn "Skipped HTTP checks (-SkipHttpChecks)."
  }

  # Storage share sanity checks (requires storage key)
  try {
    $storageAccount = az storage account list -g $ResourceGroup --query '[0].name' -o tsv
    if (-not [string]::IsNullOrWhiteSpace($storageAccount)) {
      $storageKey = az storage account keys list -g $ResourceGroup -n $storageAccount --query '[0].value' -o tsv
      if (-not [string]::IsNullOrWhiteSpace($storageKey)) {
        $shares = az storage share list --account-name $storageAccount --account-key $storageKey -o json | ConvertFrom-Json
        $shareNames = @($shares | ForEach-Object { $_.name })
        foreach ($share in @('appdata','media','transcode')) {
          Assert-True ($shareNames -contains $share) "Storage share exists: $share"
        }
      } else {
        Write-Warn "Could not retrieve storage key; skipped share checks."
      }
    } else {
      Write-Warn "No storage account found; skipped share checks."
    }
  } catch {
    Write-Warn "Storage share checks failed/skipped: $($_.Exception.Message)"
  }
}

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Err ("Azure smoke test failed with {0} issue(s)." -f $failures.Count)
  exit 1
}

Write-Host ""
Write-Info "Azure smoke test passed."
exit 0
