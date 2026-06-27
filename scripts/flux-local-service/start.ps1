$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if (-not (Test-Path ".venv")) {
  Write-Host "Tao virtualenv..."
  python -m venv .venv
}

$pythonExe = Join-Path $scriptDir ".venv\\Scripts\\python.exe"
if (-not (Test-Path $pythonExe)) {
  throw "Khong tim thay Python trong .venv. Hay kiem tra cai dat python."
}

Write-Host "Khoi dong FLUX local service..."
& $pythonExe app.py
