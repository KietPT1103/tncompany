<?php

declare(strict_types=1);

final class SocialListeningAnalyticsService
{
    public function __construct(
        private readonly SocialListeningRepository $repository
    ) {
    }

    public function buildDashboard(array $filters, string $granularity = 'day'): array
    {
        $totalComments = $this->repository->fetchTotalCount($filters);
        $brandBreakdown = $this->repository->fetchBrandBreakdown($filters);
        $sentimentByBrand = $this->repository->fetchSentimentBreakdown($filters);
        $topTopics = $this->repository->fetchTopTopics($filters, 8);
        $topKeywords = $this->repository->fetchTopKeywords($filters, 12);
        $negativeComments = $this->repository->fetchNegativeComments($filters, 10);
        $timeSeries = $this->repository->fetchTimeSeries($filters, $granularity);

        $sentimentTotals = [
            'positive' => 0,
            'neutral' => 0,
            'negative' => 0,
            'total' => 0,
        ];

        foreach ($sentimentByBrand as $row) {
            $sentimentTotals['positive'] += (int) ($row['positive'] ?? 0);
            $sentimentTotals['neutral'] += (int) ($row['neutral'] ?? 0);
            $sentimentTotals['negative'] += (int) ($row['negative'] ?? 0);
            $sentimentTotals['total'] += (int) ($row['total'] ?? 0);
        }

        return [
            'filters' => $filters,
            'overview' => [
                'totalComments' => $totalComments,
                'brandBreakdown' => $brandBreakdown,
                'comparison' => $this->buildPreviousPeriodComparison($filters),
            ],
            'sentiment' => [
                'overall' => $this->appendPercentages($sentimentTotals),
                'byBrand' => array_map(fn (array $row): array => $this->appendPercentages($row), $sentimentByBrand),
            ],
            'topics' => [
                'topTopics' => $topTopics,
                'topKeywords' => $topKeywords,
            ],
            'alerts' => [
                'negativeComments' => $negativeComments,
                'repeatedIssues' => $this->buildRepeatedIssues($filters),
            ],
            'timeSeries' => $timeSeries,
        ];
    }

    public function resolveMonthRange(string $month): array
    {
        $start = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $month . '-01 00:00:00');
        if (!$start) {
            throw new InvalidArgumentException('Month must be in YYYY-MM format.');
        }

        $end = $start->modify('last day of this month');
        return [
            'startDate' => $start->format('Y-m-d'),
            'endDate' => $end->format('Y-m-d'),
        ];
    }

    private function buildPreviousPeriodComparison(array $filters): array
    {
        if (!empty($filters['month'])) {
            $currentMonth = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $filters['month'] . '-01 00:00:00');
            if (!$currentMonth) {
                return [
                    'previousTotalComments' => 0,
                    'delta' => 0,
                    'percentChange' => null,
                ];
            }

            $previousMonth = $currentMonth->modify('-1 month');
            $previousFilters = ['month' => $previousMonth->format('Y-m')];
        } elseif (!empty($filters['startDate']) && !empty($filters['endDate'])) {
            $start = new DateTimeImmutable($filters['startDate']);
            $end = new DateTimeImmutable($filters['endDate']);
            $days = max(1, (int) $start->diff($end)->format('%a') + 1);
            $previousEnd = $start->modify('-1 day');
            $previousStart = $previousEnd->modify('-' . ($days - 1) . ' day');
            $previousFilters = [
                'startDate' => $previousStart->format('Y-m-d'),
                'endDate' => $previousEnd->format('Y-m-d'),
            ];
        } else {
            return [
                'previousTotalComments' => 0,
                'delta' => 0,
                'percentChange' => null,
            ];
        }

        $previousTotal = $this->repository->fetchTotalCount($previousFilters);
        $currentTotal = $this->repository->fetchTotalCount($filters);
        $delta = $currentTotal - $previousTotal;

        return [
            'previousTotalComments' => $previousTotal,
            'delta' => $delta,
            'percentChange' => $previousTotal > 0 ? round(($delta / $previousTotal) * 100, 2) : null,
        ];
    }

    private function appendPercentages(array $row): array
    {
        $total = max(1, (int) ($row['total'] ?? 0));
        $row['positiveRate'] = round(((int) ($row['positive'] ?? 0) / $total) * 100, 2);
        $row['neutralRate'] = round(((int) ($row['neutral'] ?? 0) / $total) * 100, 2);
        $row['negativeRate'] = round(((int) ($row['negative'] ?? 0) / $total) * 100, 2);

        return $row;
    }

    private function buildRepeatedIssues(array $filters): array
    {
        $negativeFilters = $filters;
        $negativeFilters['sentiment'] = 'negative';

        $topTopics = $this->repository->fetchTopTopics($negativeFilters, 6);
        $topKeywords = $this->repository->fetchTopKeywords($negativeFilters, 6);
        $issues = [];

        foreach ($topTopics as $topic) {
            $issues[] = [
                'type' => 'topic',
                'label' => $topic['label'],
                'count' => $topic['count'],
            ];
        }

        foreach ($topKeywords as $keyword) {
            $issues[] = [
                'type' => 'keyword',
                'label' => $keyword['keyword'],
                'count' => $keyword['count'],
            ];
        }

        usort($issues, static fn (array $left, array $right): int => $right['count'] <=> $left['count']);
        return array_slice($issues, 0, 8);
    }
}
