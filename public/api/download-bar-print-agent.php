<?php

declare(strict_types=1);

define('BOOTSTRAP_SKIP_DB', true);
require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/r2_storage.php';

function bar_print_agent_download_config(string $configKey, string $environmentKey): string
{
    global $config;
    $environmentValue = getenv($environmentKey);
    if ($environmentValue !== false && trim((string) $environmentValue) !== '') {
        return trim((string) $environmentValue);
    }
    return trim((string) ($config[$configKey] ?? ''));
}

$accountId = bar_print_agent_download_config('r2_account_id', 'R2_ACCOUNT_ID');
$endpoint = bar_print_agent_download_config('r2_endpoint', 'R2_ENDPOINT');
if ($endpoint === '' && $accountId !== '') {
    $endpoint = 'https://' . $accountId . '.r2.cloudflarestorage.com';
}

$storage = new R2Storage(
    $endpoint,
    bar_print_agent_download_config('r2_bucket', 'R2_BUCKET'),
    bar_print_agent_download_config('r2_access_key_id', 'R2_ACCESS_KEY_ID'),
    bar_print_agent_download_config('r2_secret_access_key', 'R2_SECRET_ACCESS_KEY')
);

$downloads = [
    'exe' => [
        'key' => 'installers/tn-company-bar-print-agent-setup-windows-x64.exe',
        'filename' => 'TN-Company-Bar-Print-Agent-Setup.exe',
    ],
    'zip' => [
        'key' => 'installers/tn-company-bar-print-agent-windows-x64.zip',
        'filename' => 'tn-company-bar-print-agent-windows-x64.zip',
    ],
];
$format = strtolower(trim((string) ($_GET['format'] ?? '')));

if ($format !== '') {
    if (!isset($downloads[$format])) {
        http_response_code(400);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Định dạng tải xuống không hợp lệ.';
        exit;
    }

    header('Cache-Control: no-store');
    header('Content-Disposition: attachment; filename="' . $downloads[$format]['filename'] . '"');
    header('Location: ' . $storage->presignedGetUrl($downloads[$format]['key'], 900), true, 302);
    exit;
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>Tải TN Company Print Agent</title>
    <style>
        *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f3f7f5;color:#18312a;font-family:Arial,sans-serif}.panel{width:min(760px,100%);padding:36px;border:1px solid #dce7e2;border-radius:24px;background:#fff;box-shadow:0 20px 60px rgba(22,74,59,.12)}.eyebrow{margin:0 0 10px;color:#08745a;font-size:12px;font-weight:800;letter-spacing:1.4px}.title{margin:0;font-size:clamp(26px,5vw,40px);line-height:1.12}.intro{margin:14px 0 28px;color:#60726c;line-height:1.6}.options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.option{display:flex;min-height:190px;flex-direction:column;padding:22px;border:1px solid #dce7e2;border-radius:18px;color:inherit;text-decoration:none;transition:.18s ease}.option:hover{border-color:#0b8064;box-shadow:0 12px 28px rgba(8,116,90,.12);transform:translateY(-2px)}.badge{align-self:flex-start;padding:5px 9px;border-radius:999px;background:#e5f4ef;color:#08745a;font-size:11px;font-weight:800}.option h2{margin:18px 0 8px;font-size:21px}.option p{margin:0;color:#687a74;font-size:14px;line-height:1.55}.action{margin-top:auto;padding-top:18px;color:#08745a;font-weight:800}.note{margin:22px 0 0;color:#7b8b86;font-size:12px;line-height:1.5}@media(max-width:620px){.panel{padding:24px}.options{grid-template-columns:1fr}.option{min-height:165px}}
    </style>
</head>
<body>
<main class="panel">
    <p class="eyebrow">TN COMPANY · WINDOWS PRINT AGENT</p>
    <h1 class="title">Chọn bản cài đặt</h1>
    <p class="intro">Cả hai bản đều chứa đầy đủ Print Agent cho máy pha chế Windows 64-bit.</p>
    <section class="options" aria-label="Lựa chọn tải xuống">
        <a class="option" href="?format=exe">
            <span class="badge">KHUYÊN DÙNG</span>
            <h2>Bản cài đặt EXE</h2>
            <p>Tải một file, mở trực tiếp và làm theo hướng dẫn. Không cần giải nén.</p>
            <span class="action">Tải file .exe →</span>
        </a>
        <a class="option" href="?format=zip">
            <span class="badge">THỦ CÔNG</span>
            <h2>Bản nén ZIP</h2>
            <p>Giải nén thư mục, sau đó mở file CAI-DAT.cmd để bắt đầu cài đặt.</p>
            <span class="action">Tải file .zip →</span>
        </a>
    </section>
    <p class="note">Windows có thể yêu cầu quyền Administrator khi cài đặt. Chỉ tải agent từ tên miền chính thức của TN Company.</p>
</main>
</body>
</html>
