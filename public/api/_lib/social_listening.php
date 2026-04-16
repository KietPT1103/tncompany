<?php

declare(strict_types=1);

require_once __DIR__ . '/social_listening/SocialListeningConfig.php';
require_once __DIR__ . '/social_listening/SocialListeningTextNormalizer.php';
require_once __DIR__ . '/social_listening/SocialListeningBrandClassifier.php';
require_once __DIR__ . '/social_listening/SocialListeningSignalTagger.php';
require_once __DIR__ . '/social_listening/SocialListeningRepository.php';
require_once __DIR__ . '/social_listening/SocialListeningSearchRepository.php';
require_once __DIR__ . '/social_listening/SocialListeningIngestionService.php';
require_once __DIR__ . '/social_listening/SocialListeningAnalyticsService.php';
require_once __DIR__ . '/social_listening/SocialListeningMonthlyReportService.php';
require_once __DIR__ . '/social_listening/TikTokUrlHelper.php';
require_once __DIR__ . '/social_listening/TikTokHttpClient.php';
require_once __DIR__ . '/social_listening/TikTokCollectorInterface.php';
require_once __DIR__ . '/social_listening/TikTokCollectorService.php';
require_once __DIR__ . '/social_listening/TikTokSearchService.php';
require_once __DIR__ . '/social_listening/FetchVideoJob.php';
require_once __DIR__ . '/social_listening/FetchCommentJob.php';
require_once __DIR__ . '/social_listening/TikTokQueueWorker.php';
require_once __DIR__ . '/social_listening/TikTokSearchController.php';
require_once __DIR__ . '/social_listening/TikTokCommentController.php';

function social_listening_services(): array
{
    static $services = null;

    if (is_array($services)) {
        return $services;
    }

    $normalizer = new SocialListeningTextNormalizer();
    $repository = new SocialListeningRepository();
    $repository->ensureSchema();
    $searchRepository = new SocialListeningSearchRepository();
    $searchRepository->ensureSchema();
    $brandClassifier = new SocialListeningBrandClassifier($normalizer);
    $signalTagger = new SocialListeningSignalTagger($normalizer);
    $analyticsService = new SocialListeningAnalyticsService($repository);
    global $config;
    $httpClient = new TikTokHttpClient($config);
    $collector = new TikTokCollectorService($config, $httpClient);
    $searchService = new TikTokSearchService($searchRepository, $collector);
    $ingestionService = new SocialListeningIngestionService($brandClassifier, $signalTagger, $repository);
    $fetchVideoJob = new FetchVideoJob($searchRepository, $collector, $searchService);
    $fetchCommentJob = new FetchCommentJob($searchRepository, $collector, $ingestionService, $searchService);

    $services = [
        'normalizer' => $normalizer,
        'repository' => $repository,
        'searchRepository' => $searchRepository,
        'brandClassifier' => $brandClassifier,
        'signalTagger' => $signalTagger,
        'ingestionService' => $ingestionService,
        'analyticsService' => $analyticsService,
        'monthlyReportService' => new SocialListeningMonthlyReportService($analyticsService, $repository),
        'httpClient' => $httpClient,
        'collector' => $collector,
        'searchService' => $searchService,
        'fetchVideoJob' => $fetchVideoJob,
        'fetchCommentJob' => $fetchCommentJob,
        'queueWorker' => new TikTokQueueWorker($searchRepository, $searchService, $fetchVideoJob, $fetchCommentJob),
        'tiktokSearchController' => new TikTokSearchController($searchService),
        'tiktokCommentController' => new TikTokCommentController($searchRepository, $searchService),
    ];

    return $services;
}
