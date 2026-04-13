<?php

declare(strict_types=1);

final class SocialListeningSignalTagger
{
    /** @var SocialListeningTextNormalizer */
    private $normalizer;

    public function __construct(SocialListeningTextNormalizer $normalizer)
    {
        $this->normalizer = $normalizer;
    }

    public function tag(string $text): array
    {
        $normalized = $this->normalizer->normalize($text);
        $content = $normalized['normalized'];
        $positiveHits = [];
        $negativeHits = [];
        $topicMatches = [];
        $positiveScore = 0;
        $negativeScore = 0;

        foreach (SocialListeningConfig::sentimentRules()['positive'] as $rule) {
            if ($this->containsTerm($content, $rule['term'])) {
                $positiveScore += (int) $rule['weight'];
                $positiveHits[] = $rule['term'];
            }
        }

        foreach (SocialListeningConfig::sentimentRules()['negative'] as $rule) {
            if ($this->containsTerm($content, $rule['term'])) {
                $negativeScore += (int) $rule['weight'];
                $negativeHits[] = $rule['term'];
            }
        }

        foreach (SocialListeningConfig::topicRules() as $topicTag => $ruleSet) {
            $hits = [];
            foreach ($ruleSet['terms'] as $term) {
                if ($this->containsTerm($content, $term)) {
                    $hits[] = $term;
                }
            }

            if ($hits !== []) {
                $topicMatches[$topicTag] = array_values(array_unique($hits));
            }
        }

        $sentiment = 'neutral';
        $sentimentScore = $positiveScore - $negativeScore;
        if ($negativeScore > $positiveScore) {
            $sentiment = 'negative';
            $sentimentScore = 0 - $negativeScore;
        } elseif ($positiveScore > $negativeScore) {
            $sentiment = 'positive';
            $sentimentScore = $positiveScore;
        }

        $topicTags = array_keys($topicMatches);
        usort($topicTags, function (string $left, string $right) use ($topicMatches): int {
            return count($topicMatches[$right]) <=> count($topicMatches[$left]);
        });

        $mergedTopicKeywords = [];
        foreach (array_values($topicMatches) as $topicKeywords) {
            $mergedTopicKeywords = array_merge($mergedTopicKeywords, $topicKeywords);
        }

        return [
            'normalizedText' => $content,
            'sentiment' => $sentiment,
            'sentimentScore' => $sentimentScore,
            'positiveHits' => array_values(array_unique($positiveHits)),
            'negativeHits' => array_values(array_unique($negativeHits)),
            'topicTags' => $topicTags,
            'topicMatches' => $topicMatches,
            'matchedKeywords' => array_values(array_unique(array_merge(
                $positiveHits,
                $negativeHits,
                $mergedTopicKeywords
            ))),
        ];
    }

    private function containsTerm(string $content, string $term): bool
    {
        return (bool) preg_match('/(^|\s)' . preg_quote($term, '/') . '(\s|$)/', $content);
    }
}
