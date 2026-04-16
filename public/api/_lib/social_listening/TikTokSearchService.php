<?php

declare(strict_types=1);

final class TikTokSearchService
{
    /** @var SocialListeningSearchRepository */
    private $searchRepository;

    /** @var TikTokCollectorInterface */
    private $collector;

    public function __construct(
        SocialListeningSearchRepository $searchRepository,
        TikTokCollectorInterface $collector
    ) {
        $this->searchRepository = $searchRepository;
        $this->collector = $collector;
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function createSearch(array $payload, ?string $requestedBy = null): array
    {
        $keyword = trim((string) ($payload['keyword'] ?? ''));
        $dateFrom = trim((string) ($payload['date_from'] ?? $payload['dateFrom'] ?? ''));
        $dateTo = trim((string) ($payload['date_to'] ?? $payload['dateTo'] ?? ''));

        if ($keyword === '') {
            throw new InvalidArgumentException('Keyword là bắt buộc.');
        }

        if (!$this->isValidDate($dateFrom) || !$this->isValidDate($dateTo)) {
            throw new InvalidArgumentException('date_from và date_to phải theo định dạng YYYY-MM-DD.');
        }

        if ($dateFrom > $dateTo) {
            throw new InvalidArgumentException('date_from không được lớn hơn date_to.');
        }

        $search = $this->searchRepository->createSearch([
            'keyword' => $keyword,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'status' => 'queued',
            'provider' => $this->collector->providerName(),
            'progress_message' => 'Đã xếp hàng tác vụ lấy video TikTok.',
            'requested_by' => $requestedBy,
            'meta' => [
                'real_data_only' => true,
            ],
        ]);

        $this->searchRepository->enqueueJob($search['id'], 'fetch_videos', [
            'search_id' => $search['id'],
        ]);

        return $this->syncSearchMetrics($search['id']);
    }

    public function getSearch(string $searchId): ?array
    {
        return $this->syncSearchMetrics($searchId);
    }

    /**
     * @param array<string, mixed> $overrides
     */
    public function syncSearchMetrics(string $searchId, array $overrides = []): ?array
    {
        $search = $this->searchRepository->getSearch($searchId);
        if ($search === null) {
            return null;
        }

        $queued = $this->searchRepository->countJobs($searchId, 'queued');
        $processing = $this->searchRepository->countJobs($searchId, 'processing');
        $completed = $this->searchRepository->countJobs($searchId, 'completed');
        $failed = $this->searchRepository->countJobs($searchId, 'failed');
        $totalComments = $this->searchRepository->countComments($searchId);

        $status = $search['status'];
        $progressMessage = $search['progress_message'];

        if ($failed > 0 && $status !== 'failed') {
            $status = 'partial_failed';
        }

        if (($queued + $processing) === 0 && $failed === 0 && !in_array($status, ['failed', 'completed'], true)) {
            $status = 'completed';
            if ($progressMessage === null || $progressMessage === '') {
                $progressMessage = 'Hoàn tất thu thập comment TikTok.';
            }
        }

        if (array_key_exists('status', $overrides)) {
            $status = (string) $overrides['status'];
        }

        if (array_key_exists('progress_message', $overrides)) {
            $progressMessage = $overrides['progress_message'] !== null
                ? trim((string) $overrides['progress_message'])
                : null;
        }

        $updatePayload = [
            'status' => $status,
            'queued_jobs' => $queued + $processing,
            'processed_jobs' => $completed,
            'total_comments' => $totalComments,
        ];

        if ($progressMessage !== null) {
            $updatePayload['progress_message'] = $progressMessage;
        }

        if (in_array($status, ['fetching_videos', 'fetching_comments'], true) && empty($search['started_at'])) {
            $updatePayload['started_at'] = (new DateTimeImmutable())->format('Y-m-d H:i:s');
        }

        if (in_array($status, ['completed', 'failed', 'partial_failed'], true)) {
            $updatePayload['finished_at'] = (new DateTimeImmutable())->format('Y-m-d H:i:s');
        }

        $updated = $this->searchRepository->updateSearch($searchId, $updatePayload);
        if ($updated === null) {
            return null;
        }

        $updated['active_jobs'] = $queued + $processing;
        $updated['failed_jobs'] = $failed;
        $updated['is_terminal'] = in_array($updated['status'], ['completed', 'failed', 'partial_failed'], true)
            && ($queued + $processing) === 0;

        return $updated;
    }

    private function isValidDate(string $value): bool
    {
        $date = DateTimeImmutable::createFromFormat('Y-m-d', $value);
        return $date instanceof DateTimeImmutable && $date->format('Y-m-d') === $value;
    }
}
