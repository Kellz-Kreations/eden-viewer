param(
  [ValidateSet('all','chatbot','envgen')]
  [string]$Suite = 'all',

  [ValidateSet('stub','http','cmd')]
  [string]$Mode = 'stub',

  [string]$HttpUrl = 'http://127.0.0.1:8000/chat',
  [string]$Cmd = ''
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$venvPython = Join-Path $repoRoot '.venv-eval\Scripts\python.exe'

if (-not (Test-Path $venvPython)) {
  Write-Host "Creating eval venv at .venv-eval ..."
  python -m venv (Join-Path $repoRoot '.venv-eval')
}

Write-Host "Installing eval dependencies ..."
& $venvPython -m pip install --upgrade pip | Out-Host
& $venvPython -m pip install -r (Join-Path $repoRoot 'evaluation\requirements.txt') | Out-Host

$env:EDEN_AGENT_MODE = $Mode
if ($Mode -eq 'http') {
  $env:EDEN_AGENT_HTTP_URL = $HttpUrl
}
if ($Mode -eq 'cmd') {
  if ([string]::IsNullOrWhiteSpace($Cmd)) {
    throw "When Mode=cmd you must pass -Cmd"
  }
  $env:EDEN_AGENT_CMD = $Cmd
}

function Invoke-EvalSuite([string]$name) {
  Write-Host "Running evaluation suite: $name (mode=$Mode)"
  & $venvPython (Join-Path $repoRoot 'evaluation\run.py') $name | Out-Host
}

switch ($Suite) {
  'chatbot' { Invoke-EvalSuite 'chatbot' }
  'envgen'  { Invoke-EvalSuite 'envgen' }
  'all' {
    Invoke-EvalSuite 'chatbot'
    Invoke-EvalSuite 'envgen'
  }
}
