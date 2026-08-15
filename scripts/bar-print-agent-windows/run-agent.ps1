$ErrorActionPreference = "Stop"

$installDirectory = $PSScriptRoot
$logDirectory = Join-Path $installDirectory "logs"
$logFile = Join-Path $logDirectory "bar-print-agent.log"
$nodeExecutable = Join-Path $installDirectory "node.exe"
$agentScript = Join-Path $installDirectory "bar-print-agent.cjs"

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
Set-Location -LiteralPath $installDirectory

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -LiteralPath $logFile -Value "[$timestamp] Starting Bar Print Agent"

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $nodeExecutable $agentScript 2>&1 | ForEach-Object {
    Add-Content -LiteralPath $logFile -Value $_.ToString()
}
$agentExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference

if ($agentExitCode -ne 0) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -LiteralPath $logFile -Value "[$timestamp] Agent stopped with exit code $agentExitCode"
}
exit $agentExitCode
