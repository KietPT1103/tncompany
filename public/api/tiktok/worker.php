<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/_lib/bootstrap.php';
require_once dirname(__DIR__) . '/_lib/social_listening.php';

global $config;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST'], true)) {
    respond_error('Method not allowed', 405);
}

$configuredKey = trim((string) ($config['tiktok_worker_key'] ?? ''));
$providedKey = trim((string) (
    $_GET['key']
    ?? $_POST['key']
    ?? ($_SERVER['HTTP_X_AGENT_KEY'] ?? '')
));

if ($configuredKey === '' || !hash_equals($configuredKey, $providedKey)) {
    respond_error('Forbidden', 403);
}

$services = social_listening_services();
/** @var TikTokQueueWorker $worker */
$worker = $services['queueWorker'];

$maxJobs = max(1, min(5, (int) ($_GET['max_jobs'] ?? $_POST['max_jobs'] ?? 1)));
$searchId = trim((string) ($_GET['search_id'] ?? $_POST['search_id'] ?? $_GET['searchId'] ?? $_POST['searchId'] ?? ''));
$processed = 0;

@set_time_limit(max(30, 60 * $maxJobs));

for ($i = 0; $i < $maxJobs; $i++) {
    $didProcess = $worker->runNext($searchId !== '' ? $searchId : null);
    if (!$didProcess) {
        break;
    }

    $processed++;
}

respond_ok([
    'processed' => $processed,
    'max_jobs' => $maxJobs,
    'search_id' => $searchId !== '' ? $searchId : null,
    'idle' => $processed === 0,
]);
