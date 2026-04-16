<?php

declare(strict_types=1);

final class TikTokQueueWorker
{
    /** @var SocialListeningSearchRepository */
    private $searchRepository;

    /** @var TikTokSearchService */
    private $searchService;

    /** @var FetchVideoJob */
    private $fetchVideoJob;

    /** @var FetchCommentJob */
    private $fetchCommentJob;

    public function __construct(
        SocialListeningSearchRepository $searchRepository,
        TikTokSearchService $searchService,
        FetchVideoJob $fetchVideoJob,
        FetchCommentJob $fetchCommentJob
    ) {
        $this->searchRepository = $searchRepository;
        $this->searchService = $searchService;
        $this->fetchVideoJob = $fetchVideoJob;
        $this->fetchCommentJob = $fetchCommentJob;
    }

    public function runNext(): bool
    {
        $job = $this->searchRepository->claimNextJob();
        if ($job === null) {
            return false;
        }

        try {
            if ($job['job_type'] === 'fetch_videos') {
                $this->fetchVideoJob->handle($job);
            } elseif ($job['job_type'] === 'fetch_comments') {
                $this->fetchCommentJob->handle($job);
            } else {
                throw new RuntimeException('Unsupported queue job type: ' . $job['job_type']);
            }

            $this->searchRepository->markJobCompleted((int) $job['id']);
            $this->searchService->syncSearchMetrics((string) $job['search_id']);
            return true;
        } catch (Throwable $exception) {
            $message = $exception->getMessage();
            error_log('TikTok queue job failed: ' . $message);

            $retryable = stripos($message, 'rate limit') !== false || stripos($message, 'timed out') !== false;
            $attempts = (int) ($job['attempts'] ?? 1);
            $maxAttempts = (int) ($job['max_attempts'] ?? 3);

            if ($retryable && $attempts < $maxAttempts) {
                $this->searchRepository->markJobRetry((int) $job['id'], $message, 180 * $attempts);
            } else {
                $this->searchRepository->markJobFailed((int) $job['id'], $message);
                $this->searchRepository->updateSearch((string) $job['search_id'], [
                    'status' => 'failed',
                    'error_message' => $message,
                    'progress_message' => 'Có lỗi khi thu thập dữ liệu TikTok.',
                ]);
            }

            $this->searchService->syncSearchMetrics((string) $job['search_id']);
            return true;
        }
    }
}
