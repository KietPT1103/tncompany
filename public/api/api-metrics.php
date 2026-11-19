<?php
declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
auth_require(['admin']);
if ($_SERVER['REQUEST_METHOD'] !== 'GET') respond_error('Method not allowed', 405);
if (getenv('API_METRICS_ENABLED') !== '1') respond_ok(['enabled' => false]);

$minutes = (int) ($_GET['minutes'] ?? 60);
if (!in_array($minutes, [15, 60, 360], true)) respond_error('Invalid time range', 422);
$filter = "recorded_at >= NOW() - INTERVAL {$minutes} MINUTE";
$rows = db()->query("SELECT route, method, COUNT(*) AS requests,
    SUM(status BETWEEN 400 AND 499) AS errors4xx,
    SUM(status >= 500) AS errors5xx,
    ROUND(AVG(duration_ms)) AS avgMs,
    SUM(duration_ms > 2000) AS slow,
    MAX(duration_ms) AS maxMs
    FROM api_request_metrics WHERE {$filter}
    GROUP BY route, method ORDER BY requests DESC")->fetchAll();
$peak = db()->query("SELECT MAX(requests) FROM (
    SELECT COUNT(*) AS requests FROM api_request_metrics WHERE {$filter}
    GROUP BY DATE_FORMAT(recorded_at, '%Y-%m-%d %H:%i')
) AS minute_counts")->fetchColumn();
respond_ok(['enabled' => true, 'rows' => $rows, 'peakPerMinute' => (int) $peak]);
