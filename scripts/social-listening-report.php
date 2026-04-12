<?php

declare(strict_types=1);

require_once __DIR__ . '/../public/api/_lib/bootstrap.php';
require_once __DIR__ . '/../public/api/_lib/social_listening.php';

$month = $argv[1] ?? date('Y-m', strtotime('first day of last month'));
$persist = !isset($argv[2]) || strtolower((string) $argv[2]) !== 'false';
$services = social_listening_services();
$result = $services['monthlyReportService']->generate($month, $persist);

echo json_encode([
    'month' => $month,
    'persist' => $persist,
    'reportId' => $result['id'] ?? null,
    'overview' => $result['report']['overview'] ?? [],
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
