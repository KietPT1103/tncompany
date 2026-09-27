param([string]$Configuration = "Release")

$ErrorActionPreference = "Stop"
$projectDirectory = $PSScriptRoot
$repositoryRoot = Resolve-Path (Join-Path $projectDirectory "../../..")
$publishDirectory = Join-Path $repositoryRoot "artifacts/inventory-print-helper-publish"
$artifactDirectory = Join-Path $repositoryRoot "artifacts"
$setupPath = Join-Path $artifactDirectory "TN-Company-Inventory-Print-Helper-Setup.exe"
$zipPath = Join-Path $artifactDirectory "tn-company-inventory-print-helper-windows-x64.zip"

New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
if (Test-Path -LiteralPath $publishDirectory) { Remove-Item -LiteralPath $publishDirectory -Recurse -Force }
if (Test-Path -LiteralPath $setupPath) { Remove-Item -LiteralPath $setupPath -Force }
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }

dotnet publish (Join-Path $projectDirectory "InventoryPrintHelper.csproj") `
  -c $Configuration -r win-x64 --self-contained true -o $publishDirectory `
  /p:PublishSingleFile=true /p:IncludeNativeLibrariesForSelfExtract=true `
  /p:EnableCompressionInSingleFile=true /p:DebugType=None /p:NuGetAudit=false
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed with exit code $LASTEXITCODE" }

$publishedExe = Join-Path $publishDirectory "InventoryPrintHelper.exe"
if (-not (Test-Path -LiteralPath $publishedExe)) { throw "Published executable not found: $publishedExe" }
Copy-Item -LiteralPath $publishedExe -Destination $setupPath
Compress-Archive -LiteralPath $setupPath -DestinationPath $zipPath -CompressionLevel Optimal

foreach ($artifact in @($setupPath, $zipPath)) {
  $hash = (Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash.ToLowerInvariant()
  $checksumPath = "$artifact.sha256"
  [IO.File]::WriteAllText($checksumPath, "$hash  $([IO.Path]::GetFileName($artifact))`n", [Text.UTF8Encoding]::new($false))
  Write-Host "$([IO.Path]::GetFileName($artifact)) $hash"
}
