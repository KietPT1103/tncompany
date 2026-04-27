$ErrorActionPreference = "Stop"

$project = Join-Path $PSScriptRoot "CashierMonitor.csproj"
$restoreDir = Join-Path $PSScriptRoot "obj"
$publishDir = Join-Path $PSScriptRoot "bin\Release\net8.0-windows\win-x64\publish"
$bundleDir = Join-Path $PSScriptRoot "bin\Release\net8.0-windows\win-x64\update-bundle"
$bundleReadmePath = Join-Path $bundleDir "README.txt"
$intermediateDir = Join-Path $env:TEMP "CashierMonitor-publish-obj"

if (Test-Path $intermediateDir) {
    Remove-Item -LiteralPath $intermediateDir -Recurse -Force
}

New-Item -ItemType Directory -Path $intermediateDir -Force | Out-Null

foreach ($restoreFile in @(
    "project.assets.json",
    "project.nuget.cache",
    "CashierMonitor.csproj.nuget.dgspec.json",
    "CashierMonitor.csproj.nuget.g.props",
    "CashierMonitor.csproj.nuget.g.targets"
)) {
    Copy-Item (Join-Path $restoreDir $restoreFile) (Join-Path $intermediateDir $restoreFile) -Force
}

dotnet publish $project -c Release -r win-x64 --self-contained true --no-restore /p:PublishSingleFile=true /p:PublishReadyToRun=true "/p:BaseIntermediateOutputPath=$intermediateDir\\" "/p:MSBuildProjectExtensionsPath=$intermediateDir\\"

if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed with exit code $LASTEXITCODE"
}

New-Item -ItemType Directory -Path $bundleDir -Force | Out-Null

Copy-Item (Join-Path $publishDir "CashierMonitor.exe") (Join-Path $bundleDir "CashierMonitor.exe") -Force
Copy-Item (Join-Path $PSScriptRoot "upgrade-agent.ps1") (Join-Path $bundleDir "upgrade-agent.ps1") -Force
Copy-Item (Join-Path $PSScriptRoot "update-agent.cmd") (Join-Path $bundleDir "update-agent.cmd") -Force

@"
Cashier Monitor update bundle

How to use:
1. Copy this whole folder to the cashier machine.
2. Open update-agent.cmd.
3. Approve the Administrator prompt.
4. Enter Machine ID and API Key when asked.
"@ | Set-Content -Path $bundleReadmePath -Encoding ASCII

Write-Host ""
Write-Host "Publish EXE:"
Write-Host (Join-Path $publishDir "CashierMonitor.exe")
Write-Host ""
Write-Host "Update bundle:"
Write-Host $bundleDir

if (Test-Path $intermediateDir) {
    Remove-Item -LiteralPath $intermediateDir -Recurse -Force
}
