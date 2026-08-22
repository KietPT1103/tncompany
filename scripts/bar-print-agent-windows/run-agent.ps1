$ErrorActionPreference = "Stop"

$installDirectory = $PSScriptRoot
$logDirectory = Join-Path $installDirectory "logs"
$logFile = Join-Path $logDirectory "bar-print-agent.log"
$nodeExecutable = Join-Path $installDirectory "node.exe"
$agentScript = Join-Path $installDirectory "bar-print-agent.cjs"

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
Set-Location -LiteralPath $installDirectory

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"

# Keep supervising the Node process. Windows may launch this task before LAN or
# Internet connectivity is ready, so a failed startup must not leave the task idle.
while ($true) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -LiteralPath $logFile -Value "[$timestamp] Starting Bar Print Agent"

    & $nodeExecutable $agentScript 2>&1 | ForEach-Object {
        Add-Content -LiteralPath $logFile -Value $_.ToString()
    }
    $agentExitCode = $LASTEXITCODE

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -LiteralPath $logFile -Value "[$timestamp] Agent stopped with exit code $agentExitCode; restarting in 3 seconds"
    Start-Sleep -Seconds 3
}

$ErrorActionPreference = $previousErrorActionPreference
