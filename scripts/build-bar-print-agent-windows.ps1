$ErrorActionPreference = "Stop"

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$sourceDirectory = Join-Path $PSScriptRoot "bar-print-agent-windows"
$agentScript = Join-Path $PSScriptRoot "bar-print-agent.cjs"
$ticketRenderer = Join-Path $PSScriptRoot "bar-print-ticket-renderer.ps1"
$nodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source
$artifactDirectory = Join-Path $repositoryRoot "artifacts"
$artifactPath = Join-Path $artifactDirectory "tn-company-bar-print-agent-windows-x64.zip"
$stagingDirectory = Join-Path ([IO.Path]::GetTempPath()) ("tn-company-bar-print-agent-" + [Guid]::NewGuid().ToString("N"))

if (-not [Environment]::Is64BitProcess) {
    throw "Can chay ban Node.js 64-bit de dong goi cho Windows x64."
}

New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $stagingDirectory -Force | Out-Null

try {
    Copy-Item -LiteralPath $nodeExecutable -Destination (Join-Path $stagingDirectory "node.exe")
    Copy-Item -LiteralPath $agentScript -Destination (Join-Path $stagingDirectory "bar-print-agent.cjs")
    Copy-Item -LiteralPath $ticketRenderer -Destination (Join-Path $stagingDirectory "bar-print-ticket-renderer.ps1")
    Get-ChildItem -LiteralPath $sourceDirectory -File | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $stagingDirectory
    }

    if (Test-Path -LiteralPath $artifactPath) {
        Remove-Item -LiteralPath $artifactPath -Force
    }
    Compress-Archive -Path (Join-Path $stagingDirectory "*") -DestinationPath $artifactPath -CompressionLevel Optimal
}
finally {
    $resolvedStagingDirectory = [IO.Path]::GetFullPath($stagingDirectory)
    $resolvedTempDirectory = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if ($resolvedStagingDirectory.StartsWith($resolvedTempDirectory, [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedStagingDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$artifact = Get-Item -LiteralPath $artifactPath
Write-Host "Created: $($artifact.FullName)"
Write-Host "Size: $([Math]::Round($artifact.Length / 1MB, 2)) MB"
