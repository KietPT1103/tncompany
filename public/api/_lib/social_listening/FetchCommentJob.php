<?php

declare(strict_types=1);

final class FetchCommentJob
{
    /** @var SocialListeningSearchRepository */
    private $searchRepository;

    /** @var TikTokCollectorInterface */
    private $collector;

    /** @var SocialListeningIngestionService */
    private $ingestionService;

    /** @var TikTokSearchService */
    private $searchService;

    public function __construct(
        SocialListeningSearchRepository $searchRepository,
        TikTokCollectorInterface $collector,
        SocialListeningIngestionService $ingestionService,
        TikTokSearchService $searchService
    ) {
        $this->searchRepository = $searchRepository;
        $this->collector = $collector;
        $this->ingestionService = $ingestionService;
        $this->searchService = $searchService;
    }

    /**
     * @param array<string, mixed> $job
     */
    public function handle(array $job): void
    {
        $searchId = trim((string) ($job['payload']['search_id'] ?? $job['search_id'] ?? ''));
        $videoId = trim((string) ($job['payload']['video_id'] ?? ''));
        $search = $this->searchRepository->getSearch($searchId);

        if ($search === null) {
            throw new RuntimeException('Comment job target search not found.');
        }

        $video = $this->searchRepository->getVideo($searchId, $videoId);
        if ($video === null) {
            throw new RuntimeException('Comment job target video not found.');
        }

        $this->collector->assertConfigured();

        $this->searchService->syncSearchMetrics($searchId, [
            'status' => 'fetching_comments',
            'progress_message' => 'Dang lay comment that tu TikTok.',
        ]);

        $items = $this->collector->fetchComments(
            $video,
            (string) $search['keyword'],
            (string) $search['date_from'],
            (string) $search['date_to']
        );

        $preparedItems = [];
        foreach ($items as $item) {
            $createdAt = trim((string) ($item['created_at'] ?? $item['createdAt'] ?? ''));

            $preparedItems[] = [
                'search_id' => $searchId,
                'keyword' => (string) $search['keyword'],
                'comment_id' => $item['comment_id'] ?? $item['commentId'] ?? null,
                'comment_text' => $item['comment_text'] ?? $item['commentText'] ?? $item['content'] ?? $item['text'] ?? null,
                'created_at' => $createdAt !== '' ? $createdAt : null,
                'author_name' => $item['author_name'] ?? $item['authorName'] ?? $item['username'] ?? $item['uniqueId'] ?? null,
                'username' => $item['username'] ?? $item['uniqueId'] ?? $item['author_name'] ?? $item['authorName'] ?? null,
                'video_id' => $item['video_id'] ?? $videoId,
                'video_username' => $item['video_username'] ?? $video['video_username'] ?? null,
                'video_url' => $item['video_url'] ?? $video['video_url'] ?? null,
                'share_url' => $item['share_url'] ?? $video['share_url'] ?? null,
                'like_count' => $item['like_count'] ?? $item['likeCount'] ?? $item['diggCount'] ?? 0,
                'metadata' => $item['metadata'] ?? $item,
            ];
        }

        $ingestion = $this->ingestionService->ingest($preparedItems);

        $this->searchService->syncSearchMetrics($searchId, [
            'status' => 'fetching_comments',
            'progress_message' => sprintf(
                'Da dong bo %d comment cho video %s.',
                (int) ($ingestion['processed'] ?? count($preparedItems)),
                $videoId
            ),
        ]);
    }
}
