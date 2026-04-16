<?php

declare(strict_types=1);

final class FetchVideoJob
{
    /** @var SocialListeningSearchRepository */
    private $searchRepository;

    /** @var TikTokCollectorInterface */
    private $collector;

    /** @var TikTokSearchService */
    private $searchService;

    public function __construct(
        SocialListeningSearchRepository $searchRepository,
        TikTokCollectorInterface $collector,
        TikTokSearchService $searchService
    ) {
        $this->searchRepository = $searchRepository;
        $this->collector = $collector;
        $this->searchService = $searchService;
    }

    /**
     * @param array<string, mixed> $job
     */
    public function handle(array $job): void
    {
        $searchId = trim((string) ($job['payload']['search_id'] ?? $job['search_id'] ?? ''));
        $search = $this->searchRepository->getSearch($searchId);

        if ($search === null) {
            throw new RuntimeException('Search job target not found.');
        }

        $this->searchService->syncSearchMetrics($searchId, [
            'status' => 'fetching_videos',
            'progress_message' => 'Đang lấy danh sách video TikTok từ nguồn dữ liệu thật.',
        ]);

        $videos = $this->collector->searchVideos(
            (string) $search['keyword'],
            (string) $search['date_from'],
            (string) $search['date_to']
        );

        $storedCount = $this->searchRepository->upsertVideos($searchId, $videos);
        $queuedCommentJobs = 0;

        foreach ($videos as $video) {
            $videoId = trim((string) ($video['video_id'] ?? $video['videoId'] ?? ''));
            if ($videoId === '') {
                continue;
            }

            $this->searchRepository->enqueueJob($searchId, 'fetch_comments', [
                'search_id' => $searchId,
                'video_id' => $videoId,
            ]);
            $queuedCommentJobs++;
        }

        $this->searchRepository->updateSearch($searchId, [
            'provider' => $this->collector->providerName(),
            'total_videos' => $storedCount,
            'progress_message' => $storedCount > 0
                ? sprintf('Đã tìm thấy %d video. Đang xếp hàng lấy comment.', $storedCount)
                : 'Không tìm thấy video phù hợp từ nguồn TikTok thực.',
        ]);

        if ($queuedCommentJobs === 0) {
            $this->searchService->syncSearchMetrics($searchId, [
                'status' => 'completed',
                'progress_message' => 'Không có video phù hợp. Trả về danh sách comment rỗng.',
            ]);
        } else {
            $this->searchService->syncSearchMetrics($searchId, [
                'status' => 'fetching_comments',
                'progress_message' => sprintf('Đang lấy comment từ %d video TikTok.', $queuedCommentJobs),
            ]);
        }
    }
}
