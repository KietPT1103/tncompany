param(
    [string]$ComputerName = "",
    [string]$MachineId = "",
    [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"

# Ask for missing parameters.
if (-not $ComputerName) {
    Write-Host "=== Upgrade Agent On Cashier Machine (Remote) ===" -ForegroundColor Green
    Write-Host ""
    $ComputerName = Read-Host "Enter cashier machine name or IP"
}

if (-not $MachineId) {
    $MachineId = Read-Host "Enter Machine ID (example: MAY-THU-NGAN-01)"
}

if (-not $ApiKey) {
    $ApiKey = Read-Host "Enter API Key (example: may-thu-ngan-01)"
}

$PublishPath = Join-Path $PSScriptRoot "bin\Release\net8.0-windows\win-x64\publish\CashierMonitor.exe"

Write-Host ""
Write-Host "=== Remote Agent Upgrade ===" -ForegroundColor Green
Write-Host "Target machine: $ComputerName" -ForegroundColor Cyan
Write-Host "Machine ID: $MachineId" -ForegroundColor Cyan
Write-Host "Source file: $PublishPath" -ForegroundColor Cyan
Write-Host ""

# Verify published executable exists.
if (-not (Test-Path $PublishPath)) {
    Write-Error "Cannot find $PublishPath. Build the agent first with .\publish.ps1"
    exit 1
}

Write-Host "Step 1: Connecting to $ComputerName..." -ForegroundColor Yellow
try {
    $Session = New-PSSession -ComputerName $ComputerName -ErrorAction Stop
    Write-Host "[OK] Connected" -ForegroundColor Green
}
catch {
    Write-Error "Cannot connect to $ComputerName. Check the host name/IP and your remoting access."
    exit 1
}

Write-Host ""
Write-Host "Step 2: Copying the new EXE..." -ForegroundColor Yellow
try {
    $RemoteDesktopPath = Invoke-Command -Session $Session -ScriptBlock {
        [Environment]::GetFolderPath("Desktop")
    }
    $DestPath = Join-Path $RemoteDesktopPath "CashierMonitor.exe"

    Copy-Item $PublishPath -Destination $DestPath -ToSession $Session -Force
    Write-Host "[OK] File copied to remote Desktop" -ForegroundColor Green
}
catch {
    Write-Error "Copy failed: $_"
    Remove-PSSession $Session
    exit 1
}

Write-Host ""
Write-Host "Step 3: Running the upgrade..." -ForegroundColor Yellow
try {
    $Result = Invoke-Command -Session $Session -ScriptBlock {
        param($MachineId, $ApiKey)

        $DesktopPath = [Environment]::GetFolderPath("Desktop")
        $AgentExe = Join-Path $DesktopPath "CashierMonitor.exe"

        # Confirm the copied file is present.
        if (-not (Test-Path $AgentExe)) {
            throw "CashierMonitor.exe was not found on the remote Desktop."
        }

        # Uninstall the current agent if present.
        $AgentPath = "C:\ProgramData\TNCompany\CashierMonitor\CashierMonitor.exe"
        if (Test-Path $AgentPath) {
            & $AgentPath --uninstall 2>$null
            Start-Sleep -Seconds 2
        }

        # Install the new agent.
        & $AgentExe --install --machine-id $MachineId --server-url "https://tnservice.vn/api/activity-logs.php" --api-key $ApiKey

        return "OK"
    } -ArgumentList $MachineId, $ApiKey

    Write-Host "[OK] Upgrade completed" -ForegroundColor Green
}
catch {
    Write-Error "Upgrade failed: $_"
    Remove-PSSession $Session
    exit 1
}

Write-Host ""
Write-Host "=== Completed ===" -ForegroundColor Green
Write-Host "Agent on $ComputerName was upgraded successfully."
Write-Host ""

Remove-PSSession $Session
Write-Host "Connection closed." -ForegroundColor Cyan
