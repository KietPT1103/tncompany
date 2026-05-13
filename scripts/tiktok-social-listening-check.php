<?php

declare(strict_types=1);

require_once __DIR__ . '/../public/api/_lib/bootstrap.php';
require_once __DIR__ . '/../public/api/_lib/social_listening/TikTokUrlHelper.php';
require_once __DIR__ . '/../public/api/_lib/social_listening/TikTokCollectorInterface.php';
require_once __DIR__ . '/../public/api/_lib/social_listening/TikTokHttpClient.php';
require_once __DIR__ . '/../public/api/_lib/social_listening/TikTokCollectorService.php';

global $config;

$collector = new TikTokCollectorService($config, new TikTokHttpClient($config));

$summary = [
    'provider' => $collector->providerName(),
    'request_timeout' => (int) ($config['tiktok_request_timeout'] ?? 45),
    'max_videos' => (int) ($config['tiktok_max_videos'] ?? 20),
    'max_comments_per_video' => (int) ($config['tiktok_max_comments_per_video'] ?? 200),
    'webhook_base_url' => (string) ($config['tiktok_upstream_base_url'] ?? ''),
    'has_upstream_token' => trim((string) ($config['tiktok_upstream_token'] ?? '')) !== '',
    'has_apify_token' => trim((string) ($config['tiktok_apify_token'] ?? '')) !== '',
    'has_apify_search_actor_id' => trim((string) ($config['tiktok_apify_search_actor_id'] ?? '')) !== '',
    'has_apify_comment_actor_id' => trim((string) ($config['tiktok_apify_comment_actor_id'] ?? '')) !== '',
];

echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;

try {
    $collector->assertConfigured();
    fwrite(STDOUT, "Configuration check: OK\n");
} catch (Throwable $exception) {
    fwrite(STDERR, "Configuration check: FAIL\n");
    fwrite(STDERR, $exception->getMessage() . PHP_EOL);
    exit(1);
}

if (($argv[1] ?? '') !== '--search') {
    exit(0);
}

$keyword = trim((string) ($argv[2] ?? ''));
$dateFrom = trim((string) ($argv[3] ?? ''));
$dateTo = trim((string) ($argv[4] ?? ''));

if ($keyword === '' || $dateFrom === '' || $dateTo === '') {
    fwrite(STDERR, "Usage: php scripts/tiktok-social-listening-check.php --search \"keyword\" YYYY-MM-DD YYYY-MM-DD\n");
    exit(1);
}

$videos = $collector->searchVideos($keyword, $dateFrom, $dateTo);
$sampleVideos = array_slice(array_map(
    static function (array $video): array {
        return [
            'video_id' => (string) ($video['video_id'] ?? ''),
            'video_username' => $video['video_username'] ?? null,
            'video_url' => $video['video_url'] ?? null,
            'share_url' => $video['share_url'] ?? null,
            'published_at' => $video['published_at'] ?? null,
        ];
    },
    $videos
), 0, 5);

echo json_encode([
    'keyword' => $keyword,
    'date_from' => $dateFrom,
    'date_to' => $dateTo,
    'video_count' => count($videos),
    'sample_videos' => $sampleVideos,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
