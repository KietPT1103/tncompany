<?php

declare(strict_types=1);

require_once __DIR__ . '/social_listening/SocialListeningConfig.php';
require_once __DIR__ . '/social_listening/SocialListeningTextNormalizer.php';
require_once __DIR__ . '/social_listening/SocialListeningBrandClassifier.php';
require_once __DIR__ . '/social_listening/SocialListeningSignalTagger.php';
require_once __DIR__ . '/social_listening/SocialListeningRepository.php';
require_once __DIR__ . '/social_listening/SocialListeningIngestionService.php';
require_once __DIR__ . '/social_listening/SocialListeningAnalyticsService.php';
require_once __DIR__ . '/social_listening/SocialListeningMonthlyReportService.php';
require_once __DIR__ . '/social_listening/SocialListeningMockFactory.php';

function social_listening_services(): array
{
    static $services = null;

    if (is_array($services)) {
        return $services;
    }

    $normalizer = new SocialListeningTextNormalizer();
    $repository = new SocialListeningRepository();
    $repository->ensureSchema();
    $brandClassifier = new SocialListeningBrandClassifier($normalizer);
    $signalTagger = new SocialListeningSignalTagger($normalizer);
    $analyticsService = new SocialListeningAnalyticsService($repository);

    $services = [
        'normalizer' => $normalizer,
        'repository' => $repository,
        'brandClassifier' => $brandClassifier,
        'signalTagger' => $signalTagger,
        'ingestionService' => new SocialListeningIngestionService($brandClassifier, $signalTagger, $repository),
        'analyticsService' => $analyticsService,
        'monthlyReportService' => new SocialListeningMonthlyReportService($analyticsService, $repository),
        'mockFactory' => new SocialListeningMockFactory(),
    ];

    return $services;
}
