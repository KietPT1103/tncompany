<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/revenue_hub.php';

header('Cache-Control: no-store');
auth_require_permission('revenue_hub.view');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') respond_error('Method not allowed', 405);

try {
    foreach (['source', 'from', 'to', 'store'] as $parameter) {
        if (isset($_GET[$parameter]) && !is_string($_GET[$parameter])) {
            throw new InvalidArgumentException('Bộ lọc không hợp lệ.');
        }
    }
    $source = $_GET['source'] ?? 'tnservice';
    $from = $_GET['from'] ?? date('Y-m-d');
    $to = $_GET['to'] ?? $from;
    revenue_dates($from, $to);
    $providers = revenue_providers();
    if (!isset($providers[$source])) throw new InvalidArgumentException('Hệ thống không hợp lệ.');
    respond_ok($providers[$source](db(), $from, $to, $_GET['store'] ?? 'all'));
} catch (InvalidArgumentException $error) {
    respond_error($error->getMessage(), 422);
} catch (LogicException $error) {
    respond_error($error->getMessage(), 503);
} catch (Throwable $error) {
    respond_error('Chưa tải được dữ liệu. Thử lại sau.', 502);
}
