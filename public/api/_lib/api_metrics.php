<?php
declare(strict_types=1);

function api_metrics_record(): void
{
    $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
    if (!preg_match('~^/api/([a-z0-9_/-]+\.php)$~D', $script, $match)
        || $match[1] === 'api-metrics.php') return;

    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if (!in_array($method, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], true)) return;
    $resource = $_GET['resource'] ?? '';
    $allowed = ['tables', 'surcharges', 'bills', 'shifts', 'live-orders', 'bar-jobs', 'vouchers'];
    $route = $match[1];
    if ($route === 'pos.php' && in_array($resource, $allowed, true)) $route .= '/' . $resource;
    $status = http_response_code() ?: 200;
    $ms = min(3600000, max(0, (int) round((microtime(true) - ($_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true))) * 1000)));
    try {
        $pdo = db();
        $pdo->prepare('INSERT INTO api_request_metrics (route, method, status, duration_ms) VALUES (?, ?, ?, ?)')
            ->execute([$route, $method, $status, $ms]);
        if (random_int(1, 1000) === 1) {
            $pdo->exec('DELETE FROM api_request_metrics WHERE recorded_at < NOW() - INTERVAL 7 DAY ORDER BY recorded_at LIMIT 5000');
        }
    } catch (Throwable $error) {
        error_log('API metrics write failed: ' . $error->getCode());
    }
}
