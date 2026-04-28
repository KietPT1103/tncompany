param(
    [string]$MachineId = "",
    [string]$ServerUrl = "https://tnservice.vn/api/activity-logs.php",
    [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-InstalledConfig {
    param(
        [string]$ConfigPath
    )

    if (-not (Test-Path $ConfigPath)) {
        return $null
    }

    try {
        return Get-Content -Path $ConfigPath -Raw | ConvertFrom-Json
    }
    catch {
        Write-Warning "Cannot read installed config from $ConfigPath. Missing values will be asked again."
        return $null
    }
}

function Stop-InstalledAgent {
    param(
        [string]$ExecutablePath
    )

    $normalizedPath = $ExecutablePath.ToLowerInvariant()
    $processes = Get-CimInstance Win32_Process -Filter "Name = 'CashierMonitor.exe'" |
        Where-Object { $_.ExecutablePath -and $_.ExecutablePath.ToLowerInvariant() -eq $normalizedPath }

    if (-not $processes) {
        Write-Host "[OK] Installed agent is not running" -ForegroundColor Green
        return
    }

    foreach ($process in $processes) {
        try {
            Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
            Write-Host "[OK] Stopped process $($process.ProcessId)" -ForegroundColor Green
        }
        catch {
            Write-Warning "Could not stop process $($process.ProcessId): $_"
        }
    }

    for ($attempt = 1; $attempt -le 10; $attempt += 1) {
        $stillRunning = Get-CimInstance Win32_Process -Filter "Name = 'CashierMonitor.exe'" |
            Where-Object { $_.ExecutablePath -and $_.ExecutablePath.ToLowerInvariant() -eq $normalizedPath }

        if (-not $stillRunning) {
            Write-Host "[OK] Installed agent has fully stopped" -ForegroundColor Green
            return
        }

        Write-Host "Waiting for process handle to be released..." -ForegroundColor DarkYellow
        Start-Sleep -Seconds 1
    }

    Write-Warning "The installed agent still appears to be running. The EXE replacement may fail if Windows is still locking the file."
}

function Replace-InstalledExe {
    param(
        [string]$SourcePath,
        [string]$TempPath,
        [string]$TargetPath
    )

    Copy-Item $SourcePath $TempPath -Force

    for ($attempt = 1; $attempt -le 15; $attempt += 1) {
        try {
            Copy-Item $TempPath $TargetPath -Force
            Write-Host "[OK] Installed EXE replaced" -ForegroundColor Green
            return
        }
        catch {
            if ($attempt -eq 15) {
                throw
            }

            Write-Host "Installed EXE is still locked. Retrying..." -ForegroundColor DarkYellow
            Start-Sleep -Seconds 1
        }
    }
}

if (-not (Test-Administrator)) {
    Write-Error "Please run this update as Administrator."
    exit 1
}

Set-Location -Path $env:TEMP

$InstalledDir = "C:\ProgramData\TNCompany\CashierMonitor"
$InstalledExePath = Join-Path $InstalledDir "CashierMonitor.exe"
$InstalledConfigPath = Join-Path $InstalledDir "config.json"
$BundleExePath = Join-Path $PSScriptRoot "CashierMonitor.exe"
$TempExePath = Join-Path $env:TEMP "CashierMonitor.update.exe"
$InstalledConfig = Get-InstalledConfig -ConfigPath $InstalledConfigPath
$CanUpdateInPlace = (Test-Path $InstalledExePath) -and ($null -ne $InstalledConfig)

if ($InstalledConfig) {
    if (-not $MachineId -and $InstalledConfig.machineId) {
        $MachineId = [string]$InstalledConfig.machineId
    }

    if (($PSBoundParameters.ContainsKey("ServerUrl") -eq $false) -and $InstalledConfig.serverUrl) {
        $ServerUrl = [string]$InstalledConfig.serverUrl
    }

    if (-not $ApiKey -and $InstalledConfig.apiKey) {
        $ApiKey = [string]$InstalledConfig.apiKey
    }
}

Write-Host ""
Write-Host "=== Upgrade Agent ===" -ForegroundColor Green
Write-Host "Bundle EXE: $BundleExePath" -ForegroundColor Cyan
if ($InstalledConfig) {
    Write-Host "Installed config: $InstalledConfigPath" -ForegroundColor Cyan
}
Write-Host ""

if (-not (Test-Path $BundleExePath)) {
    Write-Error "Cannot find CashierMonitor.exe next to this script. Copy the full update bundle first."
    exit 1
}

if ($CanUpdateInPlace) {
    Write-Host "Mode: update existing install without asking for Machine ID or API Key" -ForegroundColor Cyan
    Write-Host "Machine ID: $MachineId" -ForegroundColor Cyan
    Write-Host "Server URL: $ServerUrl" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "Step 1: Stopping the installed agent..." -ForegroundColor Yellow
    Stop-InstalledAgent -ExecutablePath $InstalledExePath

    Write-Host ""
    Write-Host "Step 2: Replacing the installed EXE..." -ForegroundColor Yellow
    Replace-InstalledExe -SourcePath $BundleExePath -TempPath $TempExePath -TargetPath $InstalledExePath

    Write-Host ""
    Write-Host "Step 3: Starting the updated agent..." -ForegroundColor Yellow
    Start-Process -FilePath $InstalledExePath -WindowStyle Hidden
    Write-Host "[OK] Updated agent started" -ForegroundColor Green
}
else {
    if (-not $MachineId -or -not $ApiKey) {
        Write-Host "=== Cashier Monitor Install / Repair ===" -ForegroundColor Green
        Write-Host ""

        if (-not $MachineId) {
            $MachineId = Read-Host "Enter Machine ID (example: MAY-THU-NGAN-01)"
        }

        if (-not $ApiKey) {
            $ApiKey = Read-Host "Enter API Key (example: may-thu-ngan-01)"
        }
    }

    Write-Host "Mode: install or repair" -ForegroundColor Cyan
    Write-Host "Machine ID: $MachineId" -ForegroundColor Cyan
    Write-Host "Server URL: $ServerUrl" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "Step 1: Preparing the new EXE..." -ForegroundColor Yellow
    Copy-Item $BundleExePath $TempExePath -Force
    Write-Host "[OK] New EXE is ready" -ForegroundColor Green

    Write-Host ""
    Write-Host "Step 2: Installing the agent..." -ForegroundColor Yellow
    try {
        & $TempExePath --install --machine-id $MachineId --server-url $ServerUrl --api-key $ApiKey
        Write-Host "[OK] Installation completed" -ForegroundColor Green
    }
    catch {
        Write-Error "Installation failed: $_"
        exit 1
    }
}

Write-Host ""
Write-Host "=== Completed ===" -ForegroundColor Green
Write-Host "Agent was upgraded successfully."
Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor Yellow
[void][System.Console]::ReadKey($true)
