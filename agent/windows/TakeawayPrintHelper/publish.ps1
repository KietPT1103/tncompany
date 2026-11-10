param([string]$Configuration = "Release")
$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
$outputDirectory = Join-Path $repositoryRoot "artifacts/takeaway-print-helper-setup-publish"
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
dotnet publish (Join-Path $PSScriptRoot "TakeawayPrintHelper.csproj") -c $Configuration -r win-x64 --self-contained true -o $outputDirectory /p:PublishSingleFile=true /p:IncludeNativeLibrariesForSelfExtract=true /p:DebugType=None /p:NuGetAudit=false
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }
$executable = Join-Path $outputDirectory "TakeawayPrintHelper.exe"
$setup = Join-Path $repositoryRoot "artifacts/TN-Company-Takeaway-Print-Helper-Setup.exe"
Copy-Item -LiteralPath $executable -Destination $setup -Force
$zip = Join-Path $repositoryRoot "artifacts/tn-company-takeaway-print-helper-windows-x64.zip"
Compress-Archive -LiteralPath $setup -DestinationPath $zip -Force
foreach ($artifact in @($setup,$zip)) {
  $hash = (Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash.ToLowerInvariant()
  [IO.File]::WriteAllText("$artifact.sha256", "$hash  $([IO.Path]::GetFileName($artifact))`n", [Text.UTF8Encoding]::new($false))
}
Write-Host "Setup: $setup"
Write-Host "ZIP: $zip"
