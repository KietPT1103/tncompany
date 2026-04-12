<?php

declare(strict_types=1);

final class SocialListeningBrandClassifier
{
    public function __construct(
        private readonly SocialListeningTextNormalizer $normalizer
    ) {
    }

    public function classify(string $text): array
    {
        $normalized = $this->normalizer->normalize($text);
        $content = $normalized['normalized'];
        $hasGeneralBrand = $this->containsAny($content, SocialListeningConfig::generalBrandTerms());
        $scores = [];
        $matchedKeywords = [];

        foreach (SocialListeningConfig::brandRules() as $brandGroup => $ruleSet) {
            $score = 0;
            $hits = [];

            foreach ($ruleSet['aliases'] as $rule) {
                if ($this->containsTerm($content, $rule['term'])) {
                    $score += (int) $rule['weight'];
                    $hits[] = $rule['term'];
                }
            }

            if ($hasGeneralBrand) {
                foreach ($ruleSet['context'] as $rule) {
                    if ($this->containsTerm($content, $rule['term'])) {
                        $score += (int) $rule['weight'];
                        $hits[] = $rule['term'];
                    }
                }
            }

            $scores[$brandGroup] = $score;
            if ($hits !== []) {
                $matchedKeywords[$brandGroup] = array_values(array_unique($hits));
            }
        }

        arsort($scores);
        $primaryGroup = 'unknown';
        $topScore = 0;
        $secondaryScore = 0;
        $primaryKeywords = [];

        foreach ($scores as $brandGroup => $score) {
            if ($score <= 0) {
                continue;
            }

            if ($primaryGroup === 'unknown') {
                $primaryGroup = $brandGroup;
                $topScore = $score;
                $primaryKeywords = $matchedKeywords[$brandGroup] ?? [];
                continue;
            }

            if ($score > $secondaryScore) {
                $secondaryScore = $score;
            }
        }

        if ($primaryGroup === 'unknown' && $hasGeneralBrand) {
            $primaryGroup = 'general_ong_quan';
            $topScore = 1;
        }

        $confidence = $this->calculateConfidence($topScore, $secondaryScore, $scores);

        return [
            'normalizedText' => $content,
            'primaryGroup' => $primaryGroup,
            'primaryLabel' => SocialListeningConfig::brandLabels()[$primaryGroup] ?? $primaryGroup,
            'confidence' => $confidence,
            'scores' => $scores,
            'matchedKeywords' => $primaryKeywords,
            'matchedGroups' => array_keys(array_filter($scores, static fn (int $value): bool => $value > 0)),
            'hasGeneralBrand' => $hasGeneralBrand,
        ];
    }

    private function calculateConfidence(int $topScore, int $secondaryScore, array $scores): float
    {
        if ($topScore <= 0) {
            return 0.0;
        }

        $scoreSum = array_sum($scores);
        $ratio = $scoreSum > 0 ? $topScore / $scoreSum : 1;
        $margin = max(0, $topScore - $secondaryScore);
        $strength = min(1, $topScore / 8);

        return round(min(1, ($ratio * 0.55) + ($strength * 0.35) + (min(1, $margin / 4) * 0.1)), 4);
    }

    private function containsAny(string $content, array $terms): bool
    {
        foreach ($terms as $term) {
            if ($this->containsTerm($content, $term)) {
                return true;
            }
        }

        return false;
    }

    private function containsTerm(string $content, string $term): bool
    {
        return (bool) preg_match('/(^|\s)' . preg_quote($term, '/') . '(\s|$)/', $content);
    }
}
