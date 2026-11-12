<?php

declare(strict_types=1);
require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/revenue_access.php';
auth_require(['admin']);
header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') respond_error('Method not allowed', 405);
try {
    $body = read_json_body();
    if (($body['action'] ?? null) === 'link') {
        respond_ok(['path' => '/d/' . revenue_access_generate_link(db())]);
    }
    if (isset($body['code']) && !is_string($body['code'])) throw new InvalidArgumentException('Mã không hợp lệ.');
    respond_ok(['code' => revenue_access_generate(db(), $body['code'] ?? null)]);
} catch (InvalidArgumentException $e) {
    respond_error($e->getMessage(), 422);
} catch (Throwable $e) {
    respond_error('Chưa tạo được mã. Thử lại sau.', 502);
}
