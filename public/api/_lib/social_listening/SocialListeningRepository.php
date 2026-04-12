<?php

declare(strict_types=1);

final class SocialListeningRepository
{
    public function ensureSchema(): void
    {
        db()->exec(
            'CREATE TABLE IF NOT EXISTS social_listening_comments (
                id VARCHAR(64) PRIMARY KEY,
                platform VARCHAR(32) NOT NULL DEFAULT "tiktok",
                comment_id VARCHAR(128) NOT NULL,
                video_id VARCHAR(128) NOT NULL,
                author_name VARCHAR(255) NULL,
                author_id VARCHAR(128) NULL,
                comment_text TEXT NOT NULL,
                normalized_text TEXT NOT NULL,
                parent_comment_id VARCHAR(128) NULL,
                platform_created_at DATETIME NULL,
                collected_at DATETIME NOT NULL,
                comment_date DATE NOT NULL,
                report_month CHAR(7) NOT NULL,
                like_count INT NOT NULL DEFAULT 0,
                raw_metadata LONGTEXT NULL,
                brand_group VARCHAR(50) NOT NULL DEFAULT "unknown",
                brand_confidence DECIMAL(8,4) NOT NULL DEFAULT 0,
                brand_scores_json LONGTEXT NULL,
                matched_keywords_json LONGTEXT NULL,
                sentiment VARCHAR(20) NOT NULL DEFAULT "neutral",
                sentiment_score INT NOT NULL DEFAULT 0,
                topic_tags_json LONGTEXT NULL,
                processing_version VARCHAR(32) NOT NULL DEFAULT "rule-v1",
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_social_platform_comment (platform, comment_id),
                KEY idx_social_comment_date (comment_date),
                KEY idx_social_report_month (report_month),
                KEY idx_social_brand_date (brand_group, comment_date),
                KEY idx_social_sentiment_date (sentiment, comment_date),
                KEY idx_social_video (video_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );

        db()->exec(
            'CREATE TABLE IF NOT EXISTS social_listening_comment_topics (
                id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
                comment_row_id VARCHAR(64) NOT NULL,
                topic_tag VARCHAR(64) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_social_comment_topic (comment_row_id, topic_tag),
                KEY idx_social_topic_tag (topic_tag),
                CONSTRAINT fk_social_comment_topic_comment
                    FOREIGN KEY (comment_row_id) REFERENCES social_listening_comments(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );

        db()->exec(
            'CREATE TABLE IF NOT EXISTS social_listening_reports (
                id VARCHAR(64) PRIMARY KEY,
                platform VARCHAR(32) NOT NULL DEFAULT "tiktok",
                report_month CHAR(7) NOT NULL,
                title VARCHAR(255) NOT NULL,
                total_comments INT NOT NULL DEFAULT 0,
                generated_at DATETIME NOT NULL,
                report_json LONGTEXT NOT NULL,
                summary_markdown LONGTEXT NULL,
                summary_html LONGTEXT NULL,
                detail_csv LONGTEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_social_report_month_platform (platform, report_month),
                KEY idx_social_report_generated (generated_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    public function upsertComments(array $rows): array
    {
        if ($rows === []) {
            return [
                'processed' => 0,
                'inserted' => 0,
                'updated' => 0,
            ];
        }

        $existingIds = $this->fetchExistingCommentIds($rows);
        $statement = db()->prepare(
            'INSERT INTO social_listening_comments (
                id, platform, comment_id, video_id, author_name, author_id, comment_text,
                normalized_text, parent_comment_id, platform_created_at, collected_at,
                comment_date, report_month, like_count, raw_metadata, brand_group,
                brand_confidence, brand_scores_json, matched_keywords_json, sentiment,
                sentiment_score, topic_tags_json, processing_version
            ) VALUES (
                :id, :platform, :comment_id, :video_id, :author_name, :author_id, :comment_text,
                :normalized_text, :parent_comment_id, :platform_created_at, :collected_at,
                :comment_date, :report_month, :like_count, :raw_metadata, :brand_group,
                :brand_confidence, :brand_scores_json, :matched_keywords_json, :sentiment,
                :sentiment_score, :topic_tags_json, :processing_version
            ) ON DUPLICATE KEY UPDATE
                video_id = VALUES(video_id),
                author_name = VALUES(author_name),
                author_id = VALUES(author_id),
                comment_text = VALUES(comment_text),
                normalized_text = VALUES(normalized_text),
                parent_comment_id = VALUES(parent_comment_id),
                platform_created_at = VALUES(platform_created_at),
                collected_at = VALUES(collected_at),
                comment_date = VALUES(comment_date),
                report_month = VALUES(report_month),
                like_count = VALUES(like_count),
                raw_metadata = VALUES(raw_metadata),
                brand_group = VALUES(brand_group),
                brand_confidence = VALUES(brand_confidence),
                brand_scores_json = VALUES(brand_scores_json),
                matched_keywords_json = VALUES(matched_keywords_json),
                sentiment = VALUES(sentiment),
                sentiment_score = VALUES(sentiment_score),
                topic_tags_json = VALUES(topic_tags_json),
                processing_version = VALUES(processing_version)'
        );

        $topicDelete = db()->prepare(
            'DELETE FROM social_listening_comment_topics WHERE comment_row_id = :comment_row_id'
        );
        $topicInsert = db()->prepare(
            'INSERT INTO social_listening_comment_topics (comment_row_id, topic_tag)
             VALUES (:comment_row_id, :topic_tag)'
        );

        db()->beginTransaction();

        try {
            foreach ($rows as $row) {
                $payload = $row;
                unset($payload['topic_tags']);
                $statement->execute($payload);
                $topicDelete->execute([
                    'comment_row_id' => $row['id'],
                ]);

                foreach ($row['topic_tags'] as $topicTag) {
                    $topicInsert->execute([
                        'comment_row_id' => $row['id'],
                        'topic_tag' => $topicTag,
                    ]);
                }
            }

            db()->commit();
        } catch (Throwable $exception) {
            db()->rollBack();
            throw $exception;
        }

        $updatedCount = 0;
        foreach ($rows as $row) {
            $key = $row['platform'] . '|' . $row['comment_id'];
            if (isset($existingIds[$key])) {
                $updatedCount++;
            }
        }

        return [
            'processed' => count($rows),
            'inserted' => count($rows) - $updatedCount,
            'updated' => $updatedCount,
        ];
    }

    public function fetchComments(array $filters = []): array
    {
        [$whereClause, $params] = $this->buildWhereClause($filters);
        $limit = max(1, min(500, (int) ($filters['limit'] ?? 50)));

        $statement = db()->prepare(
            "SELECT *
             FROM social_listening_comments
             {$whereClause}
             ORDER BY comment_date DESC, platform_created_at DESC, created_at DESC
             LIMIT {$limit}"
        );
        $statement->execute($params);

        return array_map(fn (array $row): array => $this->mapCommentRow($row), $statement->fetchAll());
    }

    public function fetchTotalCount(array $filters = []): int
    {
        [$whereClause, $params] = $this->buildWhereClause($filters);
        $statement = db()->prepare(
            "SELECT COUNT(*) AS aggregate_total
             FROM social_listening_comments
             {$whereClause}"
        );
        $statement->execute($params);
        $row = $statement->fetch();

        return (int) ($row['aggregate_total'] ?? 0);
    }

    public function fetchBrandBreakdown(array $filters = []): array
    {
        [$whereClause, $params] = $this->buildWhereClause($filters);
        $statement = db()->prepare(
            "SELECT brand_group, COUNT(*) AS total
             FROM social_listening_comments
             {$whereClause}
             GROUP BY brand_group
             ORDER BY total DESC, brand_group ASC"
        );
        $statement->execute($params);

        $labels = SocialListeningConfig::brandLabels();
        return array_map(
            static fn (array $row): array => [
                'brandGroup' => (string) $row['brand_group'],
                'brandLabel' => $labels[(string) $row['brand_group']] ?? (string) $row['brand_group'],
                'count' => (int) $row['total'],
            ],
            $statement->fetchAll()
        );
    }

    public function fetchSentimentBreakdown(array $filters = []): array
    {
        [$whereClause, $params] = $this->buildWhereClause($filters);
        $statement = db()->prepare(
            "SELECT brand_group, sentiment, COUNT(*) AS total
             FROM social_listening_comments
             {$whereClause}
             GROUP BY brand_group, sentiment
             ORDER BY brand_group ASC, sentiment ASC"
        );
        $statement->execute($params);

        $grouped = [];
        foreach ($statement->fetchAll() as $row) {
            $brandGroup = (string) $row['brand_group'];
            if (!isset($grouped[$brandGroup])) {
                $grouped[$brandGroup] = [
                    'brandGroup' => $brandGroup,
                    'brandLabel' => SocialListeningConfig::brandLabels()[$brandGroup] ?? $brandGroup,
                    'positive' => 0,
                    'neutral' => 0,
                    'negative' => 0,
                    'total' => 0,
                ];
            }

            $sentiment = (string) $row['sentiment'];
            $count = (int) $row['total'];
            $grouped[$brandGroup][$sentiment] = $count;
            $grouped[$brandGroup]['total'] += $count;
        }

        return array_values($grouped);
    }

    public function fetchTopTopics(array $filters = [], int $limit = 10): array
    {
        [$whereClause, $params] = $this->buildWhereClause($filters, 'c');
        $statement = db()->prepare(
            "SELECT t.topic_tag, COUNT(*) AS total
             FROM social_listening_comment_topics t
             INNER JOIN social_listening_comments c ON c.id = t.comment_row_id
             {$whereClause}
             GROUP BY t.topic_tag
             ORDER BY total DESC, t.topic_tag ASC
             LIMIT {$limit}"
        );
        $statement->execute($params);

        $topicRules = SocialListeningConfig::topicRules();
        return array_map(
            static fn (array $row): array => [
                'topicTag' => (string) $row['topic_tag'],
                'label' => $topicRules[(string) $row['topic_tag']]['label'] ?? (string) $row['topic_tag'],
                'count' => (int) $row['total'],
            ],
            $statement->fetchAll()
        );
    }

    public function fetchTopKeywords(array $filters = [], int $limit = 10): array
    {
        [$whereClause, $params] = $this->buildWhereClause($filters);
        $statement = db()->prepare(
            "SELECT matched_keywords_json
             FROM social_listening_comments
             {$whereClause}"
        );
        $statement->execute($params);

        $counts = [];
        foreach ($statement->fetchAll() as $row) {
            $keywords = json_decode((string) ($row['matched_keywords_json'] ?? '[]'), true);
            if (!is_array($keywords)) {
                continue;
            }

            foreach ($keywords as $keyword) {
                $value = trim((string) $keyword);
                if ($value === '' || in_array($value, SocialListeningConfig::keywordStopList(), true)) {
                    continue;
                }

                $counts[$value] = ($counts[$value] ?? 0) + 1;
            }
        }

        arsort($counts);
        $output = [];
        foreach (array_slice($counts, 0, $limit, true) as $keyword => $count) {
            $output[] = [
                'keyword' => $keyword,
                'count' => $count,
            ];
        }

        return $output;
    }

    public function fetchNegativeComments(array $filters = [], int $limit = 15): array
    {
        $filters['sentiment'] = 'negative';
        $filters['limit'] = $limit;
        return $this->fetchComments($filters);
    }

    public function fetchTimeSeries(array $filters = [], string $granularity = 'day'): array
    {
        [$whereClause, $params] = $this->buildWhereClause($filters);
        $bucketExpression = match ($granularity) {
            'week' => "DATE_FORMAT(comment_date, '%x-W%v')",
            'month' => "DATE_FORMAT(comment_date, '%Y-%m')",
            default => "DATE_FORMAT(comment_date, '%Y-%m-%d')",
        };

        $statement = db()->prepare(
            "SELECT {$bucketExpression} AS bucket, brand_group, COUNT(*) AS total
             FROM social_listening_comments
             {$whereClause}
             GROUP BY bucket, brand_group
             ORDER BY bucket ASC, brand_group ASC"
        );
        $statement->execute($params);

        $series = [];
        foreach ($statement->fetchAll() as $row) {
            $bucket = (string) $row['bucket'];
            if (!isset($series[$bucket])) {
                $series[$bucket] = [
                    'bucket' => $bucket,
                    'total' => 0,
                    'brands' => [],
                ];
            }

            $count = (int) $row['total'];
            $series[$bucket]['total'] += $count;
            $series[$bucket]['brands'][] = [
                'brandGroup' => (string) $row['brand_group'],
                'count' => $count,
            ];
        }

        return array_values($series);
    }

    public function listReports(int $limit = 12): array
    {
        $statement = db()->prepare(
            'SELECT *
             FROM social_listening_reports
             ORDER BY report_month DESC
             LIMIT :limit_count'
        );
        $statement->bindValue('limit_count', max(1, min(60, $limit)), PDO::PARAM_INT);
        $statement->execute();

        return array_map(
            static fn (array $row): array => [
                'id' => (string) $row['id'],
                'platform' => (string) $row['platform'],
                'reportMonth' => (string) $row['report_month'],
                'title' => (string) $row['title'],
                'totalComments' => (int) $row['total_comments'],
                'generatedAt' => (string) $row['generated_at'],
            ],
            $statement->fetchAll()
        );
    }

    public function getReportByMonth(string $month): ?array
    {
        $statement = db()->prepare(
            'SELECT *
             FROM social_listening_reports
             WHERE platform = :platform
               AND report_month = :report_month
             LIMIT 1'
        );
        $statement->execute([
            'platform' => SocialListeningConfig::PLATFORM,
            'report_month' => $month,
        ]);

        $row = $statement->fetch();
        if (!$row) {
            return null;
        }

        return [
            'id' => (string) $row['id'],
            'platform' => (string) $row['platform'],
            'reportMonth' => (string) $row['report_month'],
            'title' => (string) $row['title'],
            'totalComments' => (int) $row['total_comments'],
            'generatedAt' => (string) $row['generated_at'],
            'report' => json_decode((string) $row['report_json'], true) ?: [],
            'markdown' => (string) ($row['summary_markdown'] ?? ''),
            'html' => (string) ($row['summary_html'] ?? ''),
            'csv' => (string) ($row['detail_csv'] ?? ''),
        ];
    }

    public function saveReport(string $month, array $report, string $markdown, string $html, string $csv): string
    {
        $existing = $this->getReportByMonth($month);
        $id = $existing['id'] ?? uuidv4();
        $statement = db()->prepare(
            'INSERT INTO social_listening_reports (
                id, platform, report_month, title, total_comments, generated_at,
                report_json, summary_markdown, summary_html, detail_csv
             ) VALUES (
                :id, :platform, :report_month, :title, :total_comments, :generated_at,
                :report_json, :summary_markdown, :summary_html, :detail_csv
             ) ON DUPLICATE KEY UPDATE
                title = VALUES(title),
                total_comments = VALUES(total_comments),
                generated_at = VALUES(generated_at),
                report_json = VALUES(report_json),
                summary_markdown = VALUES(summary_markdown),
                summary_html = VALUES(summary_html),
                detail_csv = VALUES(detail_csv)'
        );
        $statement->execute([
            'id' => $id,
            'platform' => SocialListeningConfig::PLATFORM,
            'report_month' => $month,
            'title' => (string) ($report['title'] ?? ('Social Listening ' . $month)),
            'total_comments' => (int) ($report['overview']['totalComments'] ?? 0),
            'generated_at' => (string) ($report['generatedAt'] ?? (new DateTimeImmutable())->format('Y-m-d H:i:s')),
            'report_json' => json_encode($report, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'summary_markdown' => $markdown,
            'summary_html' => $html,
            'detail_csv' => $csv,
        ]);

        return $id;
    }

    private function fetchExistingCommentIds(array $rows): array
    {
        $commentIds = [];
        foreach ($rows as $row) {
            $commentIds[] = (string) $row['comment_id'];
        }

        $commentIds = array_values(array_unique($commentIds));
        if ($commentIds === []) {
            return [];
        }

        $placeholders = implode(', ', array_fill(0, count($commentIds), '?'));
        $statement = db()->prepare(
            "SELECT platform, comment_id
             FROM social_listening_comments
             WHERE platform = ?
               AND comment_id IN ({$placeholders})"
        );

        $statement->execute(array_merge([SocialListeningConfig::PLATFORM], $commentIds));
        $existing = [];

        foreach ($statement->fetchAll() as $row) {
            $existing[(string) $row['platform'] . '|' . (string) $row['comment_id']] = true;
        }

        return $existing;
    }

    private function mapCommentRow(array $row): array
    {
        $topicTags = json_decode((string) ($row['topic_tags_json'] ?? '[]'), true);
        $matchedKeywords = json_decode((string) ($row['matched_keywords_json'] ?? '[]'), true);
        $brandScores = json_decode((string) ($row['brand_scores_json'] ?? '{}'), true);
        $metadata = json_decode((string) ($row['raw_metadata'] ?? '{}'), true);

        return [
            'id' => (string) $row['id'],
            'platform' => (string) $row['platform'],
            'commentId' => (string) $row['comment_id'],
            'videoId' => (string) $row['video_id'],
            'authorName' => $row['author_name'] ?: null,
            'authorId' => $row['author_id'] ?: null,
            'commentText' => (string) $row['comment_text'],
            'normalizedText' => (string) $row['normalized_text'],
            'parentCommentId' => $row['parent_comment_id'] ?: null,
            'platformCreatedAt' => $row['platform_created_at'],
            'collectedAt' => (string) $row['collected_at'],
            'commentDate' => (string) $row['comment_date'],
            'reportMonth' => (string) $row['report_month'],
            'likeCount' => (int) $row['like_count'],
            'brandGroup' => (string) $row['brand_group'],
            'brandLabel' => SocialListeningConfig::brandLabels()[(string) $row['brand_group']] ?? (string) $row['brand_group'],
            'brandConfidence' => (float) $row['brand_confidence'],
            'brandScores' => is_array($brandScores) ? $brandScores : [],
            'sentiment' => (string) $row['sentiment'],
            'sentimentScore' => (int) $row['sentiment_score'],
            'topicTags' => is_array($topicTags) ? array_values($topicTags) : [],
            'matchedKeywords' => is_array($matchedKeywords) ? array_values($matchedKeywords) : [],
            'metadata' => is_array($metadata) ? $metadata : [],
            'processingVersion' => (string) $row['processing_version'],
        ];
    }

    private function buildWhereClause(array $filters, string $alias = ''): array
    {
        $prefix = $alias !== '' ? $alias . '.' : '';
        $conditions = [$prefix . 'platform = :platform'];
        $params = ['platform' => SocialListeningConfig::PLATFORM];

        if (!empty($filters['startDate'])) {
            $conditions[] = $prefix . 'comment_date >= :start_date';
            $params['start_date'] = $filters['startDate'];
        }

        if (!empty($filters['endDate'])) {
            $conditions[] = $prefix . 'comment_date <= :end_date';
            $params['end_date'] = $filters['endDate'];
        }

        if (!empty($filters['month'])) {
            $conditions[] = $prefix . 'report_month = :report_month';
            $params['report_month'] = $filters['month'];
        }

        if (!empty($filters['brandGroup'])) {
            $conditions[] = $prefix . 'brand_group = :brand_group';
            $params['brand_group'] = $filters['brandGroup'];
        }

        if (!empty($filters['sentiment'])) {
            $conditions[] = $prefix . 'sentiment = :sentiment';
            $params['sentiment'] = $filters['sentiment'];
        }

        if (!empty($filters['topicTag'])) {
            $conditions[] = $prefix . 'id IN (
                SELECT comment_row_id
                FROM social_listening_comment_topics
                WHERE topic_tag = :topic_tag
            )';
            $params['topic_tag'] = $filters['topicTag'];
        }

        return ['WHERE ' . implode(' AND ', $conditions), $params];
    }
}
