<?php

declare(strict_types=1);

final class SocialListeningIngestionService
{
    public function __construct(
        private readonly SocialListeningBrandClassifier $brandClassifier,
        private readonly SocialListeningSignalTagger $signalTagger,
        private readonly SocialListeningRepository $repository
    ) {
    }

    public function ingest(array $items, array $options = []): array
    {
        $processedRows = [];
        $collectedAt = (string) ($options['collectedAt'] ?? (new DateTimeImmutable())->format('Y-m-d H:i:s'));

        foreach ($items as $item) {
            $commentId = trim((string) ($item['comment_id'] ?? $item['commentId'] ?? ''));
            $videoId = trim((string) ($item['video_id'] ?? $item['videoId'] ?? ''));
            $commentText = trim((string) ($item['comment_text'] ?? $item['commentText'] ?? ''));

            if ($commentId === '' || $videoId === '' || $commentText === '') {
                continue;
            }

            $brand = $this->brandClassifier->classify($commentText);
            $signals = $this->signalTagger->tag($commentText);
            $platformCreatedAt = $this->normalizeDateTime((string) ($item['created_at'] ?? $item['createdAt'] ?? ''));
            $effectiveCreatedAt = $platformCreatedAt ?: $collectedAt;
            $commentDate = substr($effectiveCreatedAt, 0, 10);
            $matchedKeywords = array_values(array_unique(array_merge(
                $brand['matchedKeywords'],
                $signals['matchedKeywords']
            )));

            $processedRows[] = [
                'id' => trim((string) ($item['id'] ?? '')) ?: uuidv4(),
                'platform' => SocialListeningConfig::PLATFORM,
                'comment_id' => $commentId,
                'video_id' => $videoId,
                'author_name' => $this->nullableString($item['author_name'] ?? $item['authorName'] ?? null),
                'author_id' => $this->nullableString($item['author_id'] ?? $item['authorId'] ?? null),
                'comment_text' => $commentText,
                'normalized_text' => (string) $brand['normalizedText'],
                'parent_comment_id' => $this->nullableString($item['parent_comment_id'] ?? $item['parentCommentId'] ?? null),
                'platform_created_at' => $platformCreatedAt,
                'collected_at' => $collectedAt,
                'comment_date' => $commentDate,
                'report_month' => substr($commentDate, 0, 7),
                'like_count' => max(0, (int) ($item['like_count'] ?? $item['likeCount'] ?? 0)),
                'raw_metadata' => json_encode($item['metadata'] ?? $item['raw'] ?? $item, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'brand_group' => (string) $brand['primaryGroup'],
                'brand_confidence' => (float) $brand['confidence'],
                'brand_scores_json' => json_encode($brand['scores'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'matched_keywords_json' => json_encode($matchedKeywords, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'sentiment' => (string) $signals['sentiment'],
                'sentiment_score' => (int) $signals['sentimentScore'],
                'topic_tags_json' => json_encode($signals['topicTags'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'processing_version' => SocialListeningConfig::PROCESSING_VERSION,
                'topic_tags' => $signals['topicTags'],
            ];
        }

        $result = $this->repository->upsertComments($processedRows);
        $result['items'] = array_map(
            static fn (array $row): array => [
                'commentId' => $row['comment_id'],
                'videoId' => $row['video_id'],
                'brandGroup' => $row['brand_group'],
                'sentiment' => $row['sentiment'],
                'topicTags' => $row['topic_tags'],
            ],
            $processedRows
        );

        return $result;
    }

    private function nullableString(mixed $value): ?string
    {
        $normalized = trim((string) $value);
        return $normalized === '' ? null : $normalized;
    }

    private function normalizeDateTime(string $value): ?string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        try {
            return (new DateTimeImmutable($trimmed))->format('Y-m-d H:i:s');
        } catch (Throwable) {
            return null;
        }
    }
}
