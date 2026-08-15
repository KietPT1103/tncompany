#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

$taskName = "TNCompany-BarPrintAgent"
$installDirectory = Join-Path $env:ProgramData "TNCompany\BarPrintAgent"
$sourceDirectory = $PSScriptRoot

function Read-WithDefault {
    param(
        [Parameter(Mandatory = $true)][string]$Prompt,
        [string]$Default = "",
        [switch]$Required
    )

    while ($true) {
        $suffix = if ($Default) { " [$Default]" } else { "" }
        $value = Read-Host "$Prompt$suffix"
        if ([string]::IsNullOrWhiteSpace($value)) {
            $value = $Default
        }
        $value = $value.Trim()
        if (-not $Required -or $value) {
            return $value
        }
        Write-Host "Gia tri nay la bat buoc." -ForegroundColor Yellow
    }
}

function Convert-SecureStringToPlainText {
    param([Parameter(Mandatory = $true)][Security.SecureString]$SecureValue)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Assert-SingleLineValue {
    param([Parameter(Mandatory = $true)][string]$Name, [string]$Value)

    if ($Value -match "[\r\n]") {
        throw "$Name khong duoc chua ky tu xuong dong."
    }
}

function Read-EnvironmentFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    $values = @{}
    if (-not (Test-Path -LiteralPath $Path)) {
        return $values
    }

    foreach ($line in [IO.File]::ReadAllLines($Path, [Text.Encoding]::UTF8)) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        $separatorIndex = $trimmed.IndexOf("=")
        if ($separatorIndex -lt 1) { continue }
        $key = $trimmed.Substring(0, $separatorIndex).Trim()
        $value = $trimmed.Substring($separatorIndex + 1)
        $values[$key] = $value
    }
    return $values
}

Write-Host ""
Write-Host "=== CAI DAT TN COMPANY BAR PRINT AGENT ===" -ForegroundColor Cyan
Write-Host "Agent se chay an khi Windows khoi dong, khong can Node.js hay npm."
Write-Host ""

$requiredFiles = @("node.exe", "bar-print-agent.cjs", "bar-print-ticket-renderer.ps1", "run-agent.ps1")
foreach ($fileName in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $sourceDirectory $fileName))) {
        throw "Bo cai thieu file: $fileName"
    }
}

$environmentPath = Join-Path $installDirectory ".env.local"
$existingConfig = Read-EnvironmentFile -Path $environmentPath
$hasExistingConnection =
    $existingConfig["PRINT_AGENT_PRINTER_HOST"] -and
    $existingConfig["PRINT_AGENT_PRINTER_PORT"] -and
    $existingConfig["PRINT_AGENT_STORE_ID"] -and
    $existingConfig["PRINT_AGENT_TERMINAL_NAME"] -and
    $existingConfig["PRINT_AGENT_API_BASE_URL"]
$hasExistingCredentials =
    $existingConfig["PRINT_AGENT_API_TOKEN"] -or
    ($existingConfig["PRINT_AGENT_API_LOGIN"] -and $existingConfig["PRINT_AGENT_API_PASSWORD"])

if ($hasExistingConnection -and $hasExistingCredentials) {
    Write-Host "Da tim thay cau hinh cu. Dang giu nguyen thong tin may in va API." -ForegroundColor Green
    $printerHost = $existingConfig["PRINT_AGENT_PRINTER_HOST"]
    $printerPort = $existingConfig["PRINT_AGENT_PRINTER_PORT"]
    $storeId = $existingConfig["PRINT_AGENT_STORE_ID"]
    $terminalName = $existingConfig["PRINT_AGENT_TERMINAL_NAME"]
    $apiBaseUrl = $existingConfig["PRINT_AGENT_API_BASE_URL"]
    $apiToken = $existingConfig["PRINT_AGENT_API_TOKEN"]
    $apiLogin = $existingConfig["PRINT_AGENT_API_LOGIN"]
    $apiPassword = $existingConfig["PRINT_AGENT_API_PASSWORD"]
}
else {
    $printerHost = Read-WithDefault -Prompt "IP may in KV838/BP-T3" -Default "192.168.1.118" -Required
    $printerPort = Read-WithDefault -Prompt "Cong RAW cua may in" -Default "9100" -Required
    $storeId = Read-WithDefault -Prompt "Ma cua hang" -Default "cafe" -Required
    $terminalName = Read-WithDefault -Prompt "Ten may pha che" -Default $env:COMPUTERNAME -Required
    $apiBaseUrl = Read-WithDefault -Prompt "Dia chi API" -Default "https://tnservice.vn/api" -Required
    $apiToken = Read-WithDefault -Prompt "API token (Enter de dung tai khoan/mat khau)"
    $apiLogin = ""
    $apiPassword = ""
    if (-not $apiToken) {
        $apiLogin = Read-WithDefault -Prompt "Tai khoan POS co quyen bills.access hoac bar.access" -Required
        $securePassword = Read-Host "Mat khau POS" -AsSecureString
        $apiPassword = Convert-SecureStringToPlainText -SecureValue $securePassword
        if (-not $apiPassword) {
            throw "Mat khau POS la bat buoc khi khong dung API token."
        }
    }
}

if ($apiBaseUrl -notmatch "^https?://") {
    throw "Dia chi API phai bat dau bang http:// hoac https://"
}

@{
    PRINT_AGENT_PRINTER_HOST = $printerHost
    PRINT_AGENT_PRINTER_PORT = $printerPort
    PRINT_AGENT_STORE_ID = $storeId
    PRINT_AGENT_TERMINAL_NAME = $terminalName
    PRINT_AGENT_API_BASE_URL = $apiBaseUrl
    PRINT_AGENT_API_TOKEN = $apiToken
    PRINT_AGENT_API_LOGIN = $apiLogin
    PRINT_AGENT_API_PASSWORD = $apiPassword
}.GetEnumerator() | ForEach-Object {
    Assert-SingleLineValue -Name $_.Key -Value ([string]$_.Value)
}

New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $sourceDirectory "node.exe") -Destination $installDirectory -Force
Copy-Item -LiteralPath (Join-Path $sourceDirectory "bar-print-agent.cjs") -Destination $installDirectory -Force
Copy-Item -LiteralPath (Join-Path $sourceDirectory "bar-print-ticket-renderer.ps1") -Destination $installDirectory -Force
Copy-Item -LiteralPath (Join-Path $sourceDirectory "run-agent.ps1") -Destination $installDirectory -Force

$environmentLines = @(
    "PRINT_AGENT_PRINTER_HOST=$printerHost"
    "PRINT_AGENT_PRINTER_PORT=$printerPort"
    "PRINT_AGENT_STORE_ID=$storeId"
    "PRINT_AGENT_TERMINAL_NAME=$terminalName"
    "PRINT_AGENT_TIME_ZONE=Asia/Ho_Chi_Minh"
    "PRINT_AGENT_SOCKET_TIMEOUT_MS=12000"
    "PRINT_AGENT_RETRY_INTERVAL_MS=15000"
    "PRINT_AGENT_API_BASE_URL=$($apiBaseUrl.TrimEnd('/'))"
    "PRINT_AGENT_API_LOGIN=$apiLogin"
    "PRINT_AGENT_API_PASSWORD=$apiPassword"
    "PRINT_AGENT_API_TOKEN=$apiToken"
)
[IO.File]::WriteAllLines(
    $environmentPath,
    $environmentLines,
    [Text.UTF8Encoding]::new($false)
)

# Credentials are stored locally, so only SYSTEM and local administrators may read this folder.
& icacls.exe $installDirectory /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Khong the gioi han quyen truy cap thu muc cau hinh."
}

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$powerShellArguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$installDirectory\run-agent.ps1`""
$action = New-ScheduledTaskAction `
    -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
    -Argument $powerShellArguments `
    -WorkingDirectory $installDirectory
$startupTrigger = New-ScheduledTaskTrigger -AtStartup
$startupTrigger.Delay = "PT30S"
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $taskName `
    -Description "TN Company silent LAN printing for bar tickets" `
    -Action $action `
    -Trigger @($startupTrigger, $logonTrigger) `
    -Principal $principal `
    -Settings $settings | Out-Null

Write-Host ""
$runTest = Read-Host "In phieu test ngay bay gio? (Y/n)"
if ([string]::IsNullOrWhiteSpace($runTest) -or $runTest -match "^[Yy]") {
    Push-Location $installDirectory
    try {
        & (Join-Path $installDirectory "node.exe") (Join-Path $installDirectory "bar-print-agent.cjs") --test --once
        if ($LASTEXITCODE -ne 0) {
            Write-Host "In test that bai. Kiem tra IP, mang LAN va cong 9100." -ForegroundColor Yellow
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host "Dang kiem tra dang nhap API va quyen doc job pha che..."
Push-Location $installDirectory
try {
    & (Join-Path $installDirectory "node.exe") (Join-Path $installDirectory "bar-print-agent.cjs") --check
    if ($LASTEXITCODE -ne 0) {
        throw "Kiem tra API that bai. Kiem tra tai khoan, mat khau va quyen bar.access/bills.access."
    }
}
finally {
    Pop-Location
}

Start-ScheduledTask -TaskName $taskName
Write-Host ""
Write-Host "CAI DAT THANH CONG" -ForegroundColor Green
Write-Host "Agent dang chay an va se tu khoi dong cung Windows."
Write-Host "Thu muc cai dat: $installDirectory"
Write-Host "Log: $installDirectory\logs\bar-print-agent.log"
Write-Host ""
Read-Host "Nhan Enter de dong"
