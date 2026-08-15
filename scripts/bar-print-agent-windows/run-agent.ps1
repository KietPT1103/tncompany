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

try {
    & $nodeExecutable $agentScript *>> $logFile
    exit $LASTEXITCODE
}
catch {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -LiteralPath $logFile -Value "[$timestamp] Agent launcher failed: $($_.Exception.Message)"
    exit 1
}
