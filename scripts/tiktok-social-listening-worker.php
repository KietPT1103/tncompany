<?php

declare(strict_types=1);

require_once __DIR__ . '/../public/api/_lib/bootstrap.php';
require_once __DIR__ . '/../public/api/_lib/social_listening.php';

$services = social_listening_services();
/** @var TikTokQueueWorker $worker */
$worker = $services['queueWorker'];

$mode = $argv[1] ?? '--once';
$sleepSeconds = max(2, (int) ($argv[2] ?? 5));

if ($mode === '--once') {
    $processed = $worker->runNext();
    fwrite(STDOUT, $processed ? "processed\n" : "idle\n");
    exit(0);
}

if ($mode !== '--daemon') {
    fwrite(STDERR, "Usage: php scripts/tiktok-social-listening-worker.php [--once|--daemon] [sleepSeconds]\n");
    exit(1);
}

while (true) {
    $processed = $worker->runNext();
    if (!$processed) {
        sleep($sleepSeconds);
        continue;
    }

    usleep(250000);
}
