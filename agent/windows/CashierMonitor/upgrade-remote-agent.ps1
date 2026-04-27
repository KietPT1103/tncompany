param(
    [string]$ComputerName = "",
    [string]$MachineId = "",
    [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"

# Nếu chưa nhập parameter, hỏi người dùng
if (-not $ComputerName) {
    Write-Host "=== Nâng cấp Agent Trên Máy Cashier (Từ Xa) ===" -ForegroundColor Green
    Write-Host ""
    $ComputerName = Read-Host "Nhập tên hoặc IP của máy cashier"
}

if (-not $MachineId) {
    $MachineId = Read-Host "Nhập Machine ID (ví dụ: MAY-THU-NGAN-01)"
}

if (-not $ApiKey) {
    $ApiKey = Read-Host "Nhập API Key (ví dụ: may-thu-ngan-01)"
}

$PublishPath = Join-Path $PSScriptRoot "bin\Release\net8.0-windows\win-x64\publish\CashierMonitor.exe"

Write-Host ""
Write-Host "=== Nâng cấp Agent Từ Xa ===" -ForegroundColor Green
Write-Host "Máy đích: $ComputerName" -ForegroundColor Cyan
Write-Host "Machine ID: $MachineId" -ForegroundColor Cyan
Write-Host "File nguồn: $PublishPath" -ForegroundColor Cyan
Write-Host ""

# Kiểm tra file EXE tồn tại
if (-not (Test-Path $PublishPath)) {
    Write-Error "Không tìm thấy file $PublishPath. Vui lòng build agent trước: .\publish.ps1"
    exit 1
}

Write-Host "Bước 1: Kết nối tới máy $ComputerName..." -ForegroundColor Yellow
try {
    $Session = New-PSSession -ComputerName $ComputerName -ErrorAction Stop
    Write-Host "✓ Đã kết nối" -ForegroundColor Green
}
catch {
    Write-Error "Không thể kết nối tới $ComputerName. Kiểm tra tên/IP và quyền truy cập."
    exit 1
}

Write-Host ""
Write-Host "Bước 2: Copy file EXE mới..." -ForegroundColor Yellow
try {
    $DestPath = "C:\Users\$env:USERNAME\Desktop\CashierMonitor.exe"
    Copy-Item $PublishPath -Destination $DestPath -ToSession $Session -Force
    Write-Host "✓ File đã copy tới Desktop" -ForegroundColor Green
}
catch {
    Write-Error "Lỗi khi copy file: $_"
    Remove-PSSession $Session
    exit 1
}

Write-Host ""
Write-Host "Bước 3: Chạy upgrade script..." -ForegroundColor Yellow
try {
    $Result = Invoke-Command -Session $Session -ScriptBlock {
        param($MachineId, $ApiKey)
        
        $DesktopPath = "$env:USERPROFILE\Desktop"
        $UpgradeScript = Join-Path $DesktopPath "upgrade-agent.ps1"
        $AgentExe = Join-Path $DesktopPath "CashierMonitor.exe"
        
        # Kiểm tra tệp được copy thành công
        if (-not (Test-Path $AgentExe)) {
            throw "File CashierMonitor.exe không tìm thấy trên Desktop"
        }
        
        # Chạy gỡ cài
        $agentPath = "C:\ProgramData\TNCompany\CashierMonitor\CashierMonitor.exe"
        if (Test-Path $agentPath) {
            & $agentPath --uninstall 2>$null
            Start-Sleep -Seconds 2
        }
        
        # Cài agent mới
        & $AgentExe --install --machine-id $MachineId --server-url "https://tnservice.vn/api/activity-logs.php" --api-key $ApiKey
        
        return "OK"
    } -ArgumentList $MachineId, $ApiKey
    
    Write-Host "✓ Nâng cấp thành công" -ForegroundColor Green
}
catch {
    Write-Error "Lỗi khi chạy upgrade: $_"
    Remove-PSSession $Session
    exit 1
}

Write-Host ""
Write-Host "=== Hoàn thành ===" -ForegroundColor Green
Write-Host "Agent trên $ComputerName đã được nâng cấp thành công!"
Write-Host ""

Remove-PSSession $Session
Write-Host "Kết nối đã đóng." -ForegroundColor Cyan
