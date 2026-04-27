param(
    [string]$MachineId = "",
    [string]$ServerUrl = "https://tnservice.vn/api/activity-logs.php",
    [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"

# Kiểm tra quyền admin
$isAdmin = [Security.Principal.WindowsIdentity]::GetCurrent().Groups -match "S-1-5-32-544"
if (-not $isAdmin) {
    Write-Error "Vui lòng chạy script này bằng quyền Administrator"
    exit 1
}

# Nếu chưa nhập parameter, hỏi người dùng
if (-not $MachineId -or -not $ApiKey) {
    Write-Host "=== Nâng cấp Agent Cashier Monitor ===" -ForegroundColor Green
    Write-Host ""
    
    if (-not $MachineId) {
        $MachineId = Read-Host "Nhập Machine ID (ví dụ: MAY-THU-NGAN-01)"
    }
    
    if (-not $ApiKey) {
        $ApiKey = Read-Host "Nhập API Key (ví dụ: may-thu-ngan-01)"
    }
}

$AgentExePath = "C:\ProgramData\TNCompany\CashierMonitor\CashierMonitor.exe"

Write-Host ""
Write-Host "=== Nâng cấp Agent ===" -ForegroundColor Green
Write-Host "Machine ID: $MachineId" -ForegroundColor Cyan
Write-Host "Server URL: $ServerUrl" -ForegroundColor Cyan
Write-Host ""

# Bước 1: Gỡ cài version cũ
Write-Host "Bước 1: Gỡ cài version cũ..." -ForegroundColor Yellow
if (Test-Path $AgentExePath) {
    try {
        & $AgentExePath --uninstall
        Write-Host "✓ Đã gỡ cài version cũ" -ForegroundColor Green
    }
    catch {
        Write-Warning "Không thể gỡ cài tự động. Vui lòng gỡ cài thủ công từ Services hoặc Control Panel."
        Write-Host "Nhấn phím bất kỳ để tiếp tục..." -ForegroundColor Yellow
        [void][System.Console]::ReadKey($true)
    }
    Start-Sleep -Seconds 2
}
else {
    Write-Host "✓ Không tìm thấy version cũ (lần cài đầu tiên)" -ForegroundColor Green
}

Write-Host ""

# Bước 2: Sao chép file EXE mới
Write-Host "Bước 2: Chuẩn bị file mới..." -ForegroundColor Yellow
$DesktopPath = "$env:USERPROFILE\Desktop\CashierMonitor.exe"
$TempPath = "$env:TEMP\CashierMonitor.exe"

if (Test-Path $DesktopPath) {
    Write-Host "Tìm thấy file mới trên Desktop, sao chép..." -ForegroundColor Cyan
    Copy-Item $DesktopPath $TempPath -Force
}
elseif (Test-Path $TempPath) {
    Write-Host "Sử dụng file từ Temp..." -ForegroundColor Cyan
}
else {
    Write-Error "Không tìm thấy CashierMonitor.exe trên Desktop hoặc Temp. Vui lòng copy file mới vào Desktop."
    exit 1
}

Write-Host "✓ File mới đã sẵn sàng" -ForegroundColor Green
Write-Host ""

# Bước 3: Cài đặt version mới
Write-Host "Bước 3: Cài đặt version mới..." -ForegroundColor Yellow
try {
    & $TempPath --install --machine-id $MachineId --server-url $ServerUrl --api-key $ApiKey
    Write-Host "✓ Cài đặt thành công" -ForegroundColor Green
}
catch {
    Write-Error "Lỗi khi cài đặt: $_"
    exit 1
}

Write-Host ""
Write-Host "=== Hoàn thành ===" -ForegroundColor Green
Write-Host "Agent đã được nâng cấp thành công!"
Write-Host "Service sẽ tự động khởi động."
Write-Host ""
Write-Host "Nhấn phím bất kỳ để đóng..." -ForegroundColor Yellow
[void][System.Console]::ReadKey($true)
