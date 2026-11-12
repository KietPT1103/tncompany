<?php

declare(strict_types=1);
require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/db.php';
require_once __DIR__ . '/_lib/response.php';
require_once __DIR__ . '/_lib/revenue_access.php';
header('Cache-Control: no-store');

try {
    $p = db();
    revenue_access_schema($p);
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET') respond_ok(['unlocked' => revenue_access_valid($p, revenue_access_request_token())]);
    if ($method !== 'POST') respond_error('Method not allowed', 405);
    $body = read_json_body();
    if (array_key_exists('link', $body)) {
        if (!is_string($body['link'])) respond_error('Link xem doanh thu không hợp lệ.', 422);
        respond_ok(['token' => revenue_access_unlock_link($p, $body['link'], (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'))]);
    }
    if (!isset($body['code']) || !is_string($body['code'])) respond_error('Vui lòng nhập mã xem doanh thu.', 422);
    $token = revenue_access_unlock($p, $body['code'], (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    respond_ok(['token' => $token]);
} catch (RuntimeException $e) {
    $status = in_array($e->getCode(), [403, 429, 503], true) ? $e->getCode() : 502;
    if ($status === 429) header('Retry-After: 900');
    respond_error($status === 502 ? 'Chưa mở được trang doanh thu. Thử lại sau.' : $e->getMessage(), $status);
} catch (Throwable $e) {
    respond_error('Chưa mở được trang doanh thu. Thử lại sau.', 502);
}
