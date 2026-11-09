<?php
declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/office_payroll.php';

$user = auth_require();
header('Cache-Control: private, no-store');
if (($user['role'] ?? '') !== 'admin') {
    respond_error('Chỉ quản trị viên được xem và sửa lương văn phòng.', 403);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST'], true)) {
    respond_error('Method not allowed', 405);
}

$month = $_GET['month'] ?? null;
if (!is_string($month) || !preg_match('/\A[1-9][0-9]{3}-(0[1-9]|1[0-2])\z/', $month)) {
    respond_error('Tháng không hợp lệ.', 422);
}

if ($method === 'POST') {
    $amount = read_json_body()['amount'] ?? null;
    if (!is_int($amount) || $amount < 0 || $amount > 1000000000000) {
        respond_error('Nhập số tiền nguyên từ 0 đến 1.000.000.000.000 đồng.', 422);
    }
}

$pdo = db();
office_payroll_ensure_schema($pdo);

if ($method === 'POST') {
    $sql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
        ? 'INSERT INTO office_payroll_months (payroll_month, amount) VALUES (?, ?) ON CONFLICT(payroll_month) DO UPDATE SET amount = excluded.amount'
        : 'INSERT INTO office_payroll_months (payroll_month, amount) VALUES (?, ?) ON DUPLICATE KEY UPDATE amount = VALUES(amount)';
    $pdo->prepare($sql)->execute([$month, $amount]);
    respond_ok(['amount' => $amount]);
}

$amount = office_payroll_months($pdo, $month, $month)[$month] ?? null;
respond_ok(['amount' => $amount === null ? null : (int) $amount]);
