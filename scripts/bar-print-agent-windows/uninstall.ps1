#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"
$taskName = "TNCompany-BarPrintAgent"
$installDirectory = Join-Path $env:ProgramData "TNCompany\BarPrintAgent"

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

if (Test-Path -LiteralPath $installDirectory) {
    $resolvedInstallDirectory = [IO.Path]::GetFullPath($installDirectory)
    $expectedParent = [IO.Path]::GetFullPath((Join-Path $env:ProgramData "TNCompany"))
    if (-not $resolvedInstallDirectory.StartsWith($expectedParent, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Tu choi xoa thu muc ngoai pham vi TNCompany."
    }
    Remove-Item -LiteralPath $resolvedInstallDirectory -Recurse -Force
}

Write-Host "Da go TN Company Bar Print Agent." -ForegroundColor Green
Read-Host "Nhan Enter de dong"
