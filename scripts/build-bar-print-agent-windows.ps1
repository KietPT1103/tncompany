$ErrorActionPreference = "Stop"

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$sourceDirectory = Join-Path $PSScriptRoot "bar-print-agent-windows"
$agentScript = Join-Path $PSScriptRoot "bar-print-agent.cjs"
$ticketRenderer = Join-Path $PSScriptRoot "bar-print-ticket-renderer.ps1"
$nodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source
$iexpressExecutable = Join-Path $env:SystemRoot "System32\iexpress.exe"
$artifactDirectory = Join-Path $repositoryRoot "artifacts"
$artifactPath = Join-Path $artifactDirectory "tn-company-bar-print-agent-setup-windows-x64.exe"
$zipArtifactPath = Join-Path $artifactDirectory "tn-company-bar-print-agent-windows-x64.zip"
$stagingDirectory = Join-Path ([IO.Path]::GetTempPath()) ("tn-company-bar-print-agent-" + [Guid]::NewGuid().ToString("N"))
$sedPath = Join-Path ([IO.Path]::GetTempPath()) ("tn-company-bar-print-agent-" + [Guid]::NewGuid().ToString("N") + ".sed")

if (-not [Environment]::Is64BitProcess) {
    throw "Can chay ban Node.js 64-bit de dong goi cho Windows x64."
}
if (-not (Test-Path -LiteralPath $iexpressExecutable)) {
    throw "Khong tim thay IExpress cua Windows de tao file EXE."
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
    if (Test-Path -LiteralPath $zipArtifactPath) {
        Remove-Item -LiteralPath $zipArtifactPath -Force
    }
    Compress-Archive `
        -Path (Join-Path $stagingDirectory "*") `
        -DestinationPath $zipArtifactPath `
        -CompressionLevel Optimal

    $packageFiles = @(Get-ChildItem -LiteralPath $stagingDirectory -File | Sort-Object Name)
    $sourceDirectoryWithSlash = $stagingDirectory + [IO.Path]::DirectorySeparatorChar
    $sedLines = @(
        "[Version]"
        "Class=IEXPRESS"
        "SEDVersion=3"
        "[Options]"
        "PackagePurpose=InstallApp"
        "ShowInstallProgramWindow=1"
        "HideExtractAnimation=0"
        "UseLongFileName=1"
        "InsideCompressed=0"
        "CAB_FixedSize=0"
        "CAB_ResvCodeSigning=0"
        "RebootMode=N"
        "InstallPrompt=%InstallPrompt%"
        "DisplayLicense=%DisplayLicense%"
        "FinishMessage=%FinishMessage%"
        "TargetName=%TargetName%"
        "FriendlyName=%FriendlyName%"
        "AppLaunched=%AppLaunched%"
        "PostInstallCmd=%PostInstallCmd%"
        "AdminQuietInstCmd=%AdminQuietInstCmd%"
        "UserQuietInstCmd=%UserQuietInstCmd%"
        "SourceFiles=SourceFiles"
        "[SourceFiles]"
        "SourceFiles0=$sourceDirectoryWithSlash"
        "[SourceFiles0]"
    )
    for ($index = 0; $index -lt $packageFiles.Count; $index++) {
        $sedLines += "%FILE$index%="
    }
    $sedLines += @(
        "[Strings]"
        "InstallPrompt="
        "DisplayLicense="
        "FinishMessage="
        "TargetName=$artifactPath"
        "FriendlyName=TN Company Bar Print Agent"
        "AppLaunched=CAI-DAT.cmd"
        "PostInstallCmd=<None>"
        "AdminQuietInstCmd=CAI-DAT.cmd"
        "UserQuietInstCmd=CAI-DAT.cmd"
    )
    for ($index = 0; $index -lt $packageFiles.Count; $index++) {
        $quotedName = [char]34 + $packageFiles[$index].Name + [char]34
        $sedLines += "FILE$index=$quotedName"
    }
    [IO.File]::WriteAllLines($sedPath, $sedLines, [Text.Encoding]::Default)

    $iexpressProcess = Start-Process `
        -FilePath $iexpressExecutable `
        -ArgumentList @("/N", "/Q", $sedPath) `
        -WindowStyle Hidden `
        -Wait `
        -PassThru
    if ($iexpressProcess.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $artifactPath)) {
        throw "IExpress khong tao duoc bo cai EXE."
    }
}
finally {
    $resolvedStagingDirectory = [IO.Path]::GetFullPath($stagingDirectory)
    $resolvedTempDirectory = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if ($resolvedStagingDirectory.StartsWith($resolvedTempDirectory, [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedStagingDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }
    $resolvedSedPath = [IO.Path]::GetFullPath($sedPath)
    if ($resolvedSedPath.StartsWith($resolvedTempDirectory, [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedSedPath -Force -ErrorAction SilentlyContinue
    }
}

$artifact = Get-Item -LiteralPath $artifactPath
Write-Host "Created: $($artifact.FullName)"
Write-Host "Size: $([Math]::Round($artifact.Length / 1MB, 2)) MB"
$zipArtifact = Get-Item -LiteralPath $zipArtifactPath
Write-Host "Created: $($zipArtifact.FullName)"
Write-Host "Size: $([Math]::Round($zipArtifact.Length / 1MB, 2)) MB"
