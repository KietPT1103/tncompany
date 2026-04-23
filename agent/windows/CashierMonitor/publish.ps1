$ErrorActionPreference = "Stop"

$project = Join-Path $PSScriptRoot "CashierMonitor.csproj"
dotnet publish $project -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true /p:PublishReadyToRun=true

Write-Host ""
Write-Host "Output:"
Write-Host (Join-Path $PSScriptRoot "bin\Release\net8.0-windows\win-x64\publish\CashierMonitor.exe")
