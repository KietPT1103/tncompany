<?php

declare(strict_types=1);

require_once __DIR__ . '/../public/api/_lib/social_listening/SocialListeningConfig.php';
require_once __DIR__ . '/../public/api/_lib/social_listening/SocialListeningTextNormalizer.php';
require_once __DIR__ . '/../public/api/_lib/social_listening/SocialListeningBrandClassifier.php';
require_once __DIR__ . '/../public/api/_lib/social_listening/SocialListeningSignalTagger.php';

$normalizer = new SocialListeningTextNormalizer();
$brandClassifier = new SocialListeningBrandClassifier($normalizer);
$signalTagger = new SocialListeningSignalTagger($normalizer);

$brandCases = [
    ['text' => 'Cf Ong Quan view dep qua', 'expected' => 'cafe_ong_quan'],
    ['text' => 'Lau ong quan dat ban truoc dc khong', 'expected' => 'lau_ong_quan'],
    ['text' => 'Farm ong quan co capybara khong', 'expected' => 'ong_quan_farm'],
    ['text' => 'Ong Quan mo cua may gio vay', 'expected' => 'general_ong_quan'],
    ['text' => 'Quan nay dep qua', 'expected' => 'unknown'],
];

$signalCases = [
    ['text' => 'Phuc vu tot va do uong ngon', 'sentiment' => 'positive', 'topic' => 'phuc_vu'],
    ['text' => 'Qua dat va cho lau qua', 'sentiment' => 'negative', 'topic' => 'gia_ca'],
    ['text' => 'Mo cua may gio vay admin', 'sentiment' => 'neutral', 'topic' => 'gio_mo_cua'],
];

foreach ($brandCases as $case) {
    $result = $brandClassifier->classify($case['text']);
    if ($result['primaryGroup'] !== $case['expected']) {
        fwrite(STDERR, 'Brand classification failed for: ' . $case['text'] . PHP_EOL);
        exit(1);
    }
}

foreach ($signalCases as $case) {
    $result = $signalTagger->tag($case['text']);
    if ($result['sentiment'] !== $case['sentiment']) {
        fwrite(STDERR, 'Sentiment classification failed for: ' . $case['text'] . PHP_EOL);
        exit(1);
    }

    if (!in_array($case['topic'], $result['topicTags'], true)) {
        fwrite(STDERR, 'Topic tagging failed for: ' . $case['text'] . PHP_EOL);
        exit(1);
    }
}

echo "Social listening classification tests passed." . PHP_EOL;
