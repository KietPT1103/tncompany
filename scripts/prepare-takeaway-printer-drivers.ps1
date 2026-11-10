param(
  [string]$BillDriver = (Join-Path $PSScriptRoot "../kpos_driver.exe"),
  [string]$LabelDriver = (Join-Path $PSScriptRoot "../artifacts/printer-drivers/PrinterA6/PrinterA6/4BARCODE_2024.2.exe")
)
$ErrorActionPreference = 'Stop'
$artifactDirectory = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path 'artifacts'
New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
$sources = @(@{ Source=$BillDriver; Name='kiotviet-kv804-driver.exe' },@{ Source=$LabelDriver; Name='kiotviet-365b-driver.exe' })
foreach ($item in $sources) {
  if (-not (Test-Path -LiteralPath $item.Source -PathType Leaf)) { throw "Driver package missing: $($item.Source)" }
  $target = Join-Path $artifactDirectory $item.Name
  Copy-Item -LiteralPath $item.Source -Destination $target -Force
  $hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
  [IO.File]::WriteAllText("$target.sha256", "$hash  $($item.Name)`n", [Text.UTF8Encoding]::new($false))
  Write-Host "$($item.Name) $hash"
}
