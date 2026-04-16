<?php

declare(strict_types=1);

final class TikTokCollectorService implements TikTokCollectorInterface
{
    /** @var array<string, mixed> */
    private $config;

    /** @var TikTokHttpClient */
    private $httpClient;

    public function __construct(array $config, TikTokHttpClient $httpClient)
    {
        $this->config = $config;
        $this->httpClient = $httpClient;
    }

    public function providerName(): string
    {
        return trim((string) ($this->config['tiktok_provider'] ?? 'disabled')) ?: 'disabled';
    }

    public function searchVideos(string $keyword, string $dateFrom, string $dateTo): array
    {
        $provider = $this->providerName();

        if ($provider === 'apify') {
            return $this->searchVideosViaApify($keyword, $dateFrom, $dateTo);
        }

        if ($provider === 'webhook') {
            return $this->searchVideosViaWebhook($keyword, $dateFrom, $dateTo);
        }

        error_log('TikTok collector is disabled or missing provider configuration.');
        return [];
    }

    public function fetchComments(array $video, string $keyword, string $dateFrom, string $dateTo): array
    {
        $provider = $this->providerName();

        if ($provider === 'apify') {
            return $this->fetchCommentsViaApify($video, $keyword, $dateFrom, $dateTo);
        }

        if ($provider === 'webhook') {
            return $this->fetchCommentsViaWebhook($video, $keyword, $dateFrom, $dateTo);
        }

        error_log('TikTok collector is disabled or missing provider configuration.');
        return [];
    }

    private function searchVideosViaWebhook(string $keyword, string $dateFrom, string $dateTo): array
    {
        $baseUrl = rtrim((string) ($this->config['tiktok_upstream_base_url'] ?? ''), '/');
        if ($baseUrl === '') {
            error_log('TikTok webhook provider missing tiktok_upstream_base_url.');
            return [];
        }

        $response = $this->httpClient->request(
            'POST',
            $baseUrl . '/videos/search',
            $this->buildAuthHeaders(),
            [
                'keyword' => $keyword,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'max_videos' => (int) ($this->config['tiktok_max_videos'] ?? 20),
            ]
        );

        return $this->normalizeVideoItems($this->extractItemsFromResponse($response));
    }

    private function fetchCommentsViaWebhook(array $video, string $keyword, string $dateFrom, string $dateTo): array
    {
        $baseUrl = rtrim((string) ($this->config['tiktok_upstream_base_url'] ?? ''), '/');
        if ($baseUrl === '') {
            error_log('TikTok webhook provider missing tiktok_upstream_base_url.');
            return [];
        }

        $response = $this->httpClient->request(
            'POST',
            $baseUrl . '/comments/fetch',
            $this->buildAuthHeaders(),
            [
                'keyword' => $keyword,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'video_id' => (string) ($video['video_id'] ?? $video['videoId'] ?? ''),
                'video_url' => (string) ($video['video_url'] ?? $video['videoUrl'] ?? ''),
                'share_url' => (string) ($video['share_url'] ?? $video['shareUrl'] ?? ''),
                'video_username' => (string) ($video['video_username'] ?? $video['videoUsername'] ?? ''),
                'max_comments' => (int) ($this->config['tiktok_max_comments_per_video'] ?? 200),
            ]
        );

        return $this->normalizeCommentItems($this->extractItemsFromResponse($response), $video);
    }

    private function searchVideosViaApify(string $keyword, string $dateFrom, string $dateTo): array
    {
        $token = trim((string) ($this->config['tiktok_apify_token'] ?? ''));
        $actorId = trim((string) ($this->config['tiktok_apify_search_actor_id'] ?? ''));

        if ($token === '' || $actorId === '') {
            error_log('TikTok Apify provider missing token or search actor ID.');
            return [];
        }

        $response = $this->runApifyActor($actorId, [
            'searchQueries' => [$keyword],
            'keyword' => $keyword,
            'dateFrom' => $dateFrom,
            'dateTo' => $dateTo,
            'maxItems' => (int) ($this->config['tiktok_max_videos'] ?? 20),
        ], $token);

        return $this->normalizeVideoItems($response);
    }

    private function fetchCommentsViaApify(array $video, string $keyword, string $dateFrom, string $dateTo): array
    {
        $token = trim((string) ($this->config['tiktok_apify_token'] ?? ''));
        $actorId = trim((string) ($this->config['tiktok_apify_comment_actor_id'] ?? ''));
        $videoUrl = TikTokUrlHelper::buildDirectUrl(
            $keyword,
            (string) ($video['share_url'] ?? $video['shareUrl'] ?? ''),
            (string) ($video['video_url'] ?? $video['videoUrl'] ?? ''),
            (string) ($video['video_username'] ?? $video['videoUsername'] ?? ''),
            (string) ($video['video_id'] ?? $video['videoId'] ?? '')
        );

        if ($token === '' || $actorId === '' || $videoUrl === '') {
            error_log('TikTok Apify provider missing token, comment actor ID, or video URL.');
            return [];
        }

        $response = $this->runApifyActor($actorId, [
            'startUrls' => [['url' => $videoUrl]],
            'videoUrl' => $videoUrl,
            'maxItems' => (int) ($this->config['tiktok_max_comments_per_video'] ?? 200),
            'dateFrom' => $dateFrom,
            'dateTo' => $dateTo,
        ], $token);

        return $this->normalizeCommentItems($response, $video);
    }

    /**
     * @param array<string, mixed> $input
     * @return array<int, array<string, mixed>>
     */
    private function runApifyActor(string $actorId, array $input, string $token): array
    {
        $runResponse = $this->httpClient->request(
            'POST',
            sprintf(
                'https://api.apify.com/v2/acts/%s/runs?token=%s&waitForFinish=300',
                rawurlencode($actorId),
                rawurlencode($token)
            ),
            [],
            $input
        );

        $json = is_array($runResponse['json']) ? $runResponse['json'] : [];
        $data = is_array($json['data'] ?? null) ? $json['data'] : [];
        $datasetId = trim((string) ($data['defaultDatasetId'] ?? ''));

        if ($runResponse['status'] === 429) {
            throw new RuntimeException('TikTok provider rate limit reached.');
        }

        if ($runResponse['status'] >= 400 || $datasetId === '') {
            error_log('Apify actor call failed: ' . $runResponse['body']);
            return [];
        }

        $datasetResponse = $this->httpClient->request(
            'GET',
            sprintf(
                'https://api.apify.com/v2/datasets/%s/items?token=%s&clean=true',
                rawurlencode($datasetId),
                rawurlencode($token)
            )
        );

        if ($datasetResponse['status'] === 429) {
            throw new RuntimeException('TikTok provider rate limit reached.');
        }

        if ($datasetResponse['status'] >= 400 || !is_array($datasetResponse['json'])) {
            error_log('Apify dataset fetch failed: ' . $datasetResponse['body']);
            return [];
        }

        return array_values(array_filter($datasetResponse['json'], 'is_array'));
    }

    /**
     * @param array{status:int, headers:array<string,string>, body:string, json:mixed} $response
     * @return array<int, array<string, mixed>>
     */
    private function extractItemsFromResponse(array $response): array
    {
        if ($response['status'] === 429) {
            throw new RuntimeException('TikTok provider rate limit reached.');
        }

        if ($response['status'] >= 400) {
            error_log('TikTok provider request failed: ' . $response['body']);
            return [];
        }

        $json = $response['json'];
        if (!is_array($json)) {
            return [];
        }

        $items = $json['items'] ?? $json['data'] ?? $json;
        if (!is_array($items)) {
            return [];
        }

        return array_values(array_filter($items, 'is_array'));
    }

    /**
     * @param array<int, array<string, mixed>> $items
     * @return array<int, array<string, mixed>>
     */
    private function normalizeVideoItems(array $items): array
    {
        $videos = [];

        foreach ($items as $item) {
            $videoId = trim((string) ($item['video_id'] ?? $item['videoId'] ?? $item['id'] ?? $item['aweme_id'] ?? ''));
            if ($videoId === '') {
                continue;
            }

            $videoUsername = trim((string) (
                $item['video_username']
                ?? $item['videoUsername']
                ?? $item['author_username']
                ?? $item['authorName']
                ?? $item['author']['uniqueId']
                ?? $item['authorMeta']['name']
                ?? ''
            ));
            $videoUrl = TikTokUrlHelper::normalizeUrl((string) ($item['video_url'] ?? $item['videoUrl'] ?? $item['webVideoUrl'] ?? ''));
            $shareUrl = TikTokUrlHelper::normalizeUrl((string) ($item['share_url'] ?? $item['shareUrl'] ?? $item['shareUrlCopied'] ?? ''));

            $videos[] = [
                'video_id' => $videoId,
                'video_url' => $videoUrl,
                'share_url' => $shareUrl,
                'video_username' => $videoUsername !== '' ? ltrim($videoUsername, '@') : null,
                'description' => trim((string) ($item['description'] ?? $item['desc'] ?? '')),
                'published_at' => $this->normalizeDateTime(
                    (string) ($item['published_at'] ?? $item['publishedAt'] ?? $item['createTimeISO'] ?? $item['createTime'] ?? '')
                ),
                'raw' => $item,
            ];
        }

        return $videos;
    }

    /**
     * @param array<int, array<string, mixed>> $items
     * @param array<string, mixed> $video
     * @return array<int, array<string, mixed>>
     */
    private function normalizeCommentItems(array $items, array $video): array
    {
        $comments = [];
        $videoId = trim((string) ($video['video_id'] ?? $video['videoId'] ?? ''));
        $videoUrl = TikTokUrlHelper::normalizeUrl((string) ($video['video_url'] ?? $video['videoUrl'] ?? ''));
        $shareUrl = TikTokUrlHelper::normalizeUrl((string) ($video['share_url'] ?? $video['shareUrl'] ?? ''));
        $videoUsername = trim((string) ($video['video_username'] ?? $video['videoUsername'] ?? ''));

        foreach ($items as $item) {
            $commentId = trim((string) ($item['comment_id'] ?? $item['commentId'] ?? $item['cid'] ?? $item['id'] ?? ''));
            $content = trim((string) ($item['content'] ?? $item['comment_text'] ?? $item['commentText'] ?? $item['text'] ?? ''));

            if ($commentId === '' || $content === '' || $videoId === '') {
                continue;
            }

            $comments[] = [
                'comment_id' => $commentId,
                'video_id' => $videoId,
                'comment_text' => $content,
                'author_name' => trim((string) (
                    $item['username']
                    ?? $item['author_name']
                    ?? $item['authorName']
                    ?? $item['user']['uniqueId']
                    ?? $item['author']['uniqueId']
                    ?? $item['authorMeta']['name']
                    ?? ''
                )),
                'created_at' => $this->normalizeDateTime(
                    (string) ($item['created_at'] ?? $item['createdAt'] ?? $item['createTimeISO'] ?? $item['createTime'] ?? '')
                ),
                'video_url' => $videoUrl,
                'share_url' => $shareUrl,
                'video_username' => $videoUsername !== '' ? ltrim($videoUsername, '@') : null,
                'like_count' => max(0, (int) ($item['like_count'] ?? $item['diggCount'] ?? $item['likes'] ?? 0)),
                'metadata' => $item,
            ];
        }

        return $comments;
    }

    /**
     * @return array<string, string>
     */
    private function buildAuthHeaders(): array
    {
        $token = trim((string) ($this->config['tiktok_upstream_token'] ?? ''));
        if ($token === '') {
            return [];
        }

        return [
            'Authorization' => 'Bearer ' . $token,
        ];
    }

    private function normalizeDateTime(string $value): ?string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        if (ctype_digit($trimmed)) {
            try {
                return (new DateTimeImmutable('@' . $trimmed))
                    ->setTimezone(new DateTimeZone(date_default_timezone_get()))
                    ->format('Y-m-d H:i:s');
            } catch (Throwable $exception) {
                return null;
            }
        }

        try {
            return (new DateTimeImmutable($trimmed))->format('Y-m-d H:i:s');
        } catch (Throwable $exception) {
            return null;
        }
    }
}
