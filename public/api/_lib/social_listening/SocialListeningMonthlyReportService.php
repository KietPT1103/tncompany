<?php

declare(strict_types=1);

final class SocialListeningMonthlyReportService
{
    public function __construct(
        private readonly SocialListeningAnalyticsService $analyticsService,
        private readonly SocialListeningRepository $repository
    ) {
    }

    public function generate(string $month, bool $persist = true): array
    {
        $range = $this->analyticsService->resolveMonthRange($month);
        $dashboard = $this->analyticsService->buildDashboard([
            'month' => $month,
            'startDate' => $range['startDate'],
            'endDate' => $range['endDate'],
        ], 'week');
        $comments = $this->repository->fetchComments([
            'month' => $month,
            'limit' => 500,
        ]);
        $recommendations = $this->buildRecommendations($dashboard);

        $report = [
            'title' => 'TikTok Social Listening Ông Quan - ' . $month,
            'month' => $month,
            'generatedAt' => (new DateTimeImmutable())->format('Y-m-d H:i:s'),
            'range' => $range,
            'overview' => $dashboard['overview'],
            'sentiment' => $dashboard['sentiment'],
            'topics' => $dashboard['topics'],
            'alerts' => $dashboard['alerts'],
            'timeSeries' => $dashboard['timeSeries'],
            'recommendations' => $recommendations,
        ];

        $markdown = $this->renderMarkdown($report);
        $html = $this->renderHtml($report);
        $csv = $this->renderCsv($comments);
        $reportId = null;

        if ($persist) {
            $reportId = $this->repository->saveReport($month, $report, $markdown, $html, $csv);
        }

        return [
            'id' => $reportId,
            'report' => $report,
            'exports' => [
                'json' => json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'markdown' => $markdown,
                'html' => $html,
                'csv' => $csv,
            ],
        ];
    }

    private function buildRecommendations(array $dashboard): array
    {
        $recommendations = [];

        foreach ($dashboard['topics']['topTopics'] as $topic) {
            $template = SocialListeningConfig::recommendationTemplates()[$topic['topicTag']] ?? null;
            if ($template && $topic['count'] >= 2) {
                $recommendations[] = $template;
            }
        }

        $negativeRate = (float) ($dashboard['sentiment']['overall']['negativeRate'] ?? 0);
        if ($negativeRate >= 25) {
            $recommendations[] = 'Tỷ lệ bình luận tiêu cực khá cao. Nên ưu tiên phản hồi các comment âm tính và tổng hợp thành guideline truyền thông nội bộ.';
        }

        if ($recommendations === []) {
            $recommendations[] = 'Chưa có tín hiệu nổi bật vượt ngưỡng. Tiếp tục theo dõi theo tháng và giữ nhịp nội dung FAQ định kỳ.';
        }

        return array_values(array_unique($recommendations));
    }

    private function renderMarkdown(array $report): string
    {
        $brandLines = [];
        foreach ($report['overview']['brandBreakdown'] as $row) {
            $brandLines[] = '- ' . $row['brandLabel'] . ': ' . $row['count'] . ' comment';
        }

        $topicLines = [];
        foreach ($report['topics']['topTopics'] as $row) {
            $topicLines[] = '- ' . $row['label'] . ': ' . $row['count'];
        }

        $keywordLines = [];
        foreach ($report['topics']['topKeywords'] as $row) {
            $keywordLines[] = '- ' . $row['keyword'] . ': ' . $row['count'];
        }

        $negativeLines = [];
        foreach (array_slice($report['alerts']['negativeComments'], 0, 5) as $comment) {
            $negativeLines[] = '- [' . $comment['brandLabel'] . '] ' . $comment['commentText'];
        }

        $recommendationLines = [];
        foreach ($report['recommendations'] as $item) {
            $recommendationLines[] = '- ' . $item;
        }

        $comparison = $report['overview']['comparison'];
        $deltaValue = (int) ($comparison['delta'] ?? 0);
        $deltaText = $deltaValue >= 0 ? '+' . $deltaValue : (string) $deltaValue;
        $percentText = $comparison['percentChange'] === null ? 'N/A' : $comparison['percentChange'] . '%';

        return implode("\n", [
            '# ' . $report['title'],
            '',
            '## Tổng quan',
            '- Tổng số comment: ' . ($report['overview']['totalComments'] ?? 0),
            '- So với tháng trước: ' . $deltaText . ' (' . $percentText . ')',
            ...$brandLines,
            '',
            '## Sentiment',
            '- Positive: ' . ($report['sentiment']['overall']['positive'] ?? 0),
            '- Neutral: ' . ($report['sentiment']['overall']['neutral'] ?? 0),
            '- Negative: ' . ($report['sentiment']['overall']['negative'] ?? 0),
            '',
            '## Chủ đề nổi bật',
            ...$topicLines,
            '',
            '## Keyword nổi bật',
            ...$keywordLines,
            '',
            '## Comment tiêu cực cần chú ý',
            ...($negativeLines !== [] ? $negativeLines : ['- Không có comment tiêu cực nổi bật']),
            '',
            '## Đề xuất điều hướng',
            ...$recommendationLines,
        ]);
    }

    private function renderHtml(array $report): string
    {
        $topicItems = '';
        foreach ($report['topics']['topTopics'] as $row) {
            $topicItems .= '<li><strong>' . htmlspecialchars($row['label']) . ':</strong> ' . (int) $row['count'] . '</li>';
        }

        $recommendationItems = '';
        foreach ($report['recommendations'] as $item) {
            $recommendationItems .= '<li>' . htmlspecialchars($item) . '</li>';
        }

        return '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>'
            . htmlspecialchars($report['title'])
            . '</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}h1,h2{color:#111827}.card{border:1px solid #e2e8f0;border-radius:16px;padding:16px;margin-bottom:16px;background:#fff}ul{padding-left:20px}</style></head><body>'
            . '<h1>' . htmlspecialchars($report['title']) . '</h1>'
            . '<div class="card"><h2>Tổng quan</h2><p>Tổng số comment: <strong>' . (int) ($report['overview']['totalComments'] ?? 0) . '</strong></p></div>'
            . '<div class="card"><h2>Chủ đề nổi bật</h2><ul>' . $topicItems . '</ul></div>'
            . '<div class="card"><h2>Đề xuất điều hướng</h2><ul>' . $recommendationItems . '</ul></div>'
            . '</body></html>';
    }

    private function renderCsv(array $comments): string
    {
        $rows = [
            ['comment_id', 'video_id', 'brand_group', 'sentiment', 'topic_tags', 'created_at', 'author_name', 'comment_text'],
        ];

        foreach ($comments as $comment) {
            $rows[] = [
                $comment['commentId'],
                $comment['videoId'],
                $comment['brandGroup'],
                $comment['sentiment'],
                implode('|', $comment['topicTags']),
                $comment['platformCreatedAt'] ?: $comment['collectedAt'],
                $comment['authorName'] ?: '',
                preg_replace('/\s+/', ' ', $comment['commentText']) ?? $comment['commentText'],
            ];
        }

        $lines = [];
        foreach ($rows as $row) {
            $lines[] = implode(',', array_map(
                static function (mixed $value): string {
                    $escaped = str_replace('"', '""', (string) $value);
                    return '"' . $escaped . '"';
                },
                $row
            ));
        }

        return implode("\n", $lines);
    }
}
