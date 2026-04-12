<?php

declare(strict_types=1);

require_once __DIR__ . '/../public/api/_lib/bootstrap.php';
require_once __DIR__ . '/../public/api/_lib/social_listening.php';

$month = $argv[1] ?? date('Y-m');
$count = isset($argv[2]) ? max(6, min(120, (int) $argv[2])) : 24;
$services = social_listening_services();
$items = $services['mockFactory']->makeMonthSeed($month, $count);
$result = $services['ingestionService']->ingest($items);

echo json_encode([
    'month' => $month,
    'count' => $count,
    'result' => $result,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
