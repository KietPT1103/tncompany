<?php

declare(strict_types=1);

final class SocialListeningSearchRepository
{
    public function ensureSchema(): void
    {
        db()->exec(
            'CREATE TABLE IF NOT EXISTS social_listening_searches (
                id VARCHAR(64) PRIMARY KEY,
                platform VARCHAR(32) NOT NULL DEFAULT "tiktok",
                keyword VARCHAR(255) NOT NULL,
                date_from DATE NOT NULL,
                date_to DATE NOT NULL,
                status VARCHAR(32) NOT NULL DEFAULT "queued",
                provider VARCHAR(64) NULL,
                progress_message VARCHAR(255) NULL,
                requested_by VARCHAR(128) NULL,
                total_videos INT UNSIGNED NOT NULL DEFAULT 0,
                total_comments INT UNSIGNED NOT NULL DEFAULT 0,
                queued_jobs INT UNSIGNED NOT NULL DEFAULT 0,
                processed_jobs INT UNSIGNED NOT NULL DEFAULT 0,
                error_message TEXT NULL,
                meta_json LONGTEXT NULL,
                started_at DATETIME NULL,
                finished_at DATETIME NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY idx_social_search_status (status),
                KEY idx_social_search_keyword_date (keyword, date_from, date_to),
                KEY idx_social_search_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );

        db()->exec(
            'CREATE TABLE IF NOT EXISTS social_listening_search_videos (
                id VARCHAR(64) PRIMARY KEY,
                search_id VARCHAR(64) NOT NULL,
                platform VARCHAR(32) NOT NULL DEFAULT "tiktok",
                video_id VARCHAR(128) NOT NULL,
                video_url TEXT NULL,
                share_url TEXT NULL,
                video_username VARCHAR(255) NULL,
                description TEXT NULL,
                published_at DATETIME NULL,
                raw_metadata LONGTEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_social_search_video (search_id, video_id),
                KEY idx_social_search_video_search (search_id),
                CONSTRAINT fk_social_search_video_search
                    FOREIGN KEY (search_id) REFERENCES social_listening_searches(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );

        db()->exec(
            'CREATE TABLE IF NOT EXISTS social_listening_queue_jobs (
                id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
                search_id VARCHAR(64) NOT NULL,
                job_type VARCHAR(32) NOT NULL,
                status VARCHAR(32) NOT NULL DEFAULT "queued",
                payload_json LONGTEXT NOT NULL,
                attempts INT UNSIGNED NOT NULL DEFAULT 0,
                max_attempts INT UNSIGNED NOT NULL DEFAULT 3,
                available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                locked_at DATETIME NULL,
                completed_at DATETIME NULL,
                error_message TEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY idx_social_queue_status_available (status, available_at),
                KEY idx_social_queue_search_status (search_id, status),
                CONSTRAINT fk_social_queue_search
                    FOREIGN KEY (search_id) REFERENCES social_listening_searches(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );

        $this->ensureCommentColumn('search_id', 'VARCHAR(64) NULL');
        $this->ensureCommentColumn('keyword', 'VARCHAR(255) NULL');
        $this->ensureCommentColumn('username', 'VARCHAR(255) NULL');
        $this->ensureCommentColumn('video_username', 'VARCHAR(255) NULL');
        $this->ensureCommentColumn('video_url', 'TEXT NULL');
        $this->ensureCommentColumn('share_url', 'TEXT NULL');
        $this->ensureCommentIndex('idx_social_comment_search', 'search_id');
        $this->ensureCommentIndex('idx_social_comment_keyword', 'keyword');
        $this->ensureCommentUniqueIndex();
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function createSearch(array $payload): array
    {
        $id = trim((string) ($payload['id'] ?? '')) ?: uuidv4();
        $now = (new DateTimeImmutable())->format('Y-m-d H:i:s');
        $statement = db()->prepare(
            'INSERT INTO social_listening_searches (
                id, platform, keyword, date_from, date_to, status, provider, progress_message,
                requested_by, total_videos, total_comments, queued_jobs, processed_jobs,
                error_message, meta_json, started_at, finished_at, created_at, updated_at
            ) VALUES (
                :id, :platform, :keyword, :date_from, :date_to, :status, :provider, :progress_message,
                :requested_by, :total_videos, :total_comments, :queued_jobs, :processed_jobs,
                :error_message, :meta_json, :started_at, :finished_at, :created_at, :updated_at
            )'
        );
        $statement->execute([
            'id' => $id,
            'platform' => SocialListeningConfig::PLATFORM,
            'keyword' => trim((string) ($payload['keyword'] ?? '')),
            'date_from' => (string) ($payload['date_from'] ?? $payload['dateFrom'] ?? ''),
            'date_to' => (string) ($payload['date_to'] ?? $payload['dateTo'] ?? ''),
            'status' => (string) ($payload['status'] ?? 'queued'),
            'provider' => $this->nullableString($payload['provider'] ?? null),
            'progress_message' => $this->nullableString($payload['progress_message'] ?? $payload['progressMessage'] ?? null),
            'requested_by' => $this->nullableString($payload['requested_by'] ?? $payload['requestedBy'] ?? null),
            'total_videos' => max(0, (int) ($payload['total_videos'] ?? $payload['totalVideos'] ?? 0)),
            'total_comments' => max(0, (int) ($payload['total_comments'] ?? $payload['totalComments'] ?? 0)),
            'queued_jobs' => max(0, (int) ($payload['queued_jobs'] ?? $payload['queuedJobs'] ?? 0)),
            'processed_jobs' => max(0, (int) ($payload['processed_jobs'] ?? $payload['processedJobs'] ?? 0)),
            'error_message' => $this->nullableString($payload['error_message'] ?? $payload['errorMessage'] ?? null),
            'meta_json' => json_encode($payload['meta'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'started_at' => $this->nullableString($payload['started_at'] ?? $payload['startedAt'] ?? null),
            'finished_at' => $this->nullableString($payload['finished_at'] ?? $payload['finishedAt'] ?? null),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return $this->getSearch($id) ?? [];
    }

    public function getSearch(string $searchId): ?array
    {
        $statement = db()->prepare(
            'SELECT *
             FROM social_listening_searches
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute(['id' => $searchId]);
        $row = $statement->fetch();

        if (!is_array($row)) {
            return null;
        }

        return $this->mapSearchRow($row);
    }

    /**
     * @param array<string, mixed> $fields
     */
    public function updateSearch(string $searchId, array $fields): ?array
    {
        if ($fields === []) {
            return $this->getSearch($searchId);
        }

        $allowed = [
            'status',
            'provider',
            'progress_message',
            'requested_by',
            'total_videos',
            'total_comments',
            'queued_jobs',
            'processed_jobs',
            'error_message',
            'meta_json',
            'started_at',
            'finished_at',
        ];

        $setParts = [];
        $params = ['id' => $searchId];

        foreach ($allowed as $column) {
            if (!array_key_exists($column, $fields)) {
                continue;
            }

            $setParts[] = $column . ' = :' . $column;
            $params[$column] = $fields[$column];
        }

        if ($setParts === []) {
            return $this->getSearch($searchId);
        }

        $statement = db()->prepare(
            'UPDATE social_listening_searches
             SET ' . implode(', ', $setParts) . ', updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $statement->execute($params);

        return $this->getSearch($searchId);
    }

    /**
     * @param array<int, array<string, mixed>> $videos
     */
    public function upsertVideos(string $searchId, array $videos): int
    {
        if ($videos === []) {
            return 0;
        }

        $statement = db()->prepare(
            'INSERT INTO social_listening_search_videos (
                id, search_id, platform, video_id, video_url, share_url, video_username,
                description, published_at, raw_metadata
             ) VALUES (
                :id, :search_id, :platform, :video_id, :video_url, :share_url, :video_username,
                :description, :published_at, :raw_metadata
             ) ON DUPLICATE KEY UPDATE
                video_url = VALUES(video_url),
                share_url = VALUES(share_url),
                video_username = VALUES(video_username),
                description = VALUES(description),
                published_at = VALUES(published_at),
                raw_metadata = VALUES(raw_metadata)'
        );

        foreach ($videos as $video) {
            $statement->execute([
                'id' => trim((string) ($video['id'] ?? '')) ?: uuidv4(),
                'search_id' => $searchId,
                'platform' => SocialListeningConfig::PLATFORM,
                'video_id' => trim((string) ($video['video_id'] ?? $video['videoId'] ?? '')),
                'video_url' => $this->nullableString($video['video_url'] ?? $video['videoUrl'] ?? null),
                'share_url' => $this->nullableString($video['share_url'] ?? $video['shareUrl'] ?? null),
                'video_username' => $this->nullableString($video['video_username'] ?? $video['videoUsername'] ?? null),
                'description' => $this->nullableString($video['description'] ?? null),
                'published_at' => $this->nullableString($video['published_at'] ?? $video['publishedAt'] ?? null),
                'raw_metadata' => json_encode($video['raw'] ?? $video, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);
        }

        return count($videos);
    }

    public function getVideo(string $searchId, string $videoId): ?array
    {
        $statement = db()->prepare(
            'SELECT *
             FROM social_listening_search_videos
             WHERE search_id = :search_id
               AND video_id = :video_id
             LIMIT 1'
        );
        $statement->execute([
            'search_id' => $searchId,
            'video_id' => $videoId,
        ]);
        $row = $statement->fetch();

        if (!is_array($row)) {
            return null;
        }

        return $this->mapVideoRow($row);
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function enqueueJob(string $searchId, string $jobType, array $payload, int $maxAttempts = 3): int
    {
        $statement = db()->prepare(
            'INSERT INTO social_listening_queue_jobs (
                search_id, job_type, status, payload_json, attempts, max_attempts, available_at
             ) VALUES (
                :search_id, :job_type, "queued", :payload_json, 0, :max_attempts, CURRENT_TIMESTAMP
             )'
        );
        $statement->execute([
            'search_id' => $searchId,
            'job_type' => $jobType,
            'payload_json' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'max_attempts' => max(1, $maxAttempts),
        ]);

        return (int) db()->lastInsertId();
    }

    public function claimNextJob(?string $searchId = null): ?array
    {
        $this->requeueStaleProcessingJobs();
        db()->beginTransaction();

        try {
            $sql = 'SELECT *
                    FROM social_listening_queue_jobs
                    WHERE status = "queued"
                      AND available_at <= CURRENT_TIMESTAMP';
            $params = [];

            if ($searchId !== null && trim($searchId) !== '') {
                $sql .= ' AND search_id = :search_id';
                $params['search_id'] = trim($searchId);
            }

            $sql .= '
                    ORDER BY id ASC
                    LIMIT 1
                    FOR UPDATE';

            $statement = db()->prepare($sql);
            $statement->execute($params);
            $row = $statement->fetch();

            if (!is_array($row)) {
                db()->commit();
                return null;
            }

            $update = db()->prepare(
                'UPDATE social_listening_queue_jobs
                 SET status = "processing",
                     locked_at = CURRENT_TIMESTAMP,
                     attempts = attempts + 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = :id'
            );
            $update->execute(['id' => (int) $row['id']]);
            db()->commit();

            return $this->mapJobRow(array_merge($row, [
                'status' => 'processing',
                'attempts' => (int) $row['attempts'] + 1,
            ]));
        } catch (Throwable $exception) {
            db()->rollBack();
            throw $exception;
        }
    }

    private function requeueStaleProcessingJobs(): void
    {
        $staleSeconds = max(300, 60 * 15);
        $statement = db()->prepare(
            'UPDATE social_listening_queue_jobs
             SET status = "queued",
                 locked_at = NULL,
                 available_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP,
                 error_message = COALESCE(
                     CONCAT("Recovered stale processing lock at ", DATE_FORMAT(CURRENT_TIMESTAMP, "%Y-%m-%d %H:%i:%s")),
                     error_message
                 )
             WHERE status = "processing"
               AND locked_at IS NOT NULL
               AND locked_at <= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL :stale_seconds SECOND)'
        );
        $statement->bindValue('stale_seconds', $staleSeconds, PDO::PARAM_INT);
        $statement->execute();
    }

    public function markJobCompleted(int $jobId): void
    {
        $statement = db()->prepare(
            'UPDATE social_listening_queue_jobs
             SET status = "completed",
                 completed_at = CURRENT_TIMESTAMP,
                 locked_at = NULL,
                 error_message = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $statement->execute(['id' => $jobId]);
    }

    public function markJobRetry(int $jobId, string $message, int $delaySeconds = 120): void
    {
        $statement = db()->prepare(
            'UPDATE social_listening_queue_jobs
             SET status = "queued",
                 locked_at = NULL,
                 error_message = :error_message,
                 available_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL :delay_seconds SECOND),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $statement->bindValue('id', $jobId, PDO::PARAM_INT);
        $statement->bindValue('error_message', $message);
        $statement->bindValue('delay_seconds', max(30, $delaySeconds), PDO::PARAM_INT);
        $statement->execute();
    }

    public function markJobFailed(int $jobId, string $message): void
    {
        $statement = db()->prepare(
            'UPDATE social_listening_queue_jobs
             SET status = "failed",
                 locked_at = NULL,
                 error_message = :error_message,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $statement->execute([
            'id' => $jobId,
            'error_message' => $message,
        ]);
    }

    public function countJobs(string $searchId, ?string $status = null): int
    {
        $sql = 'SELECT COUNT(*) AS aggregate_total
                FROM social_listening_queue_jobs
                WHERE search_id = :search_id';
        $params = ['search_id' => $searchId];

        if ($status !== null) {
            $sql .= ' AND status = :status';
            $params['status'] = $status;
        }

        $statement = db()->prepare($sql);
        $statement->execute($params);
        $row = $statement->fetch();

        return (int) ($row['aggregate_total'] ?? 0);
    }

    public function countComments(string $searchId, string $query = ''): int
    {
        $params = ['search_id' => $searchId];
        $queryClause = $this->buildCommentQueryClause($query, $params);
        $statement = db()->prepare(
            'SELECT COUNT(*) AS aggregate_total
             FROM social_listening_comments
             WHERE search_id = :search_id' . $queryClause
        );
        $statement->execute($params);
        $row = $statement->fetch();

        return (int) ($row['aggregate_total'] ?? 0);
    }

    public function countVideos(string $searchId, string $query = ''): int
    {
        $params = ['search_id' => $searchId];
        $queryClause = $this->buildVideoQueryClause($query, $params);
        $statement = db()->prepare(
            'SELECT COUNT(*) AS aggregate_total
             FROM social_listening_search_videos
             WHERE search_id = :search_id' . $queryClause
        );
        $statement->execute($params);
        $row = $statement->fetch();

        return (int) ($row['aggregate_total'] ?? 0);
    }

    public function listVideos(string $searchId, int $page = 1, int $perPage = 20, string $query = ''): array
    {
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $total = $this->countVideos($searchId, $query);
        $offset = ($page - 1) * $perPage;
        $params = ['search_id' => $searchId];
        $queryClause = $this->buildVideoQueryClause($query, $params);

        $statement = db()->prepare(
            'SELECT *
             FROM social_listening_search_videos
             WHERE search_id = :search_id' . $queryClause . '
             ORDER BY published_at DESC, created_at DESC
             LIMIT :limit_count OFFSET :offset_count'
        );
        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value);
        }
        $statement->bindValue('limit_count', $perPage, PDO::PARAM_INT);
        $statement->bindValue('offset_count', $offset, PDO::PARAM_INT);
        $statement->execute();

        return [
            'items' => array_map(
                function (array $row): array {
                    $video = $this->mapVideoRow($row);
                    return [
                        ...$video,
                        'post_url' => TikTokUrlHelper::buildDirectUrl(
                            '',
                            $video['share_url'],
                            $video['video_url'],
                            $video['video_username'],
                            $video['video_id']
                        ),
                    ];
                },
                $statement->fetchAll()
            ),
            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'from' => $total === 0 ? 0 : ($offset + 1),
                'to' => min($total, $offset + $perPage),
                'last_page' => max(1, (int) ceil($total / $perPage)),
            ],
        ];
    }

    public function listComments(string $searchId, int $page = 1, int $perPage = 20, string $query = ''): array
    {
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $total = $this->countComments($searchId, $query);
        $offset = ($page - 1) * $perPage;
        $params = ['search_id' => $searchId];
        $queryClause = $this->buildCommentQueryClause($query, $params);

        $statement = db()->prepare(
            'SELECT *
             FROM social_listening_comments
             WHERE search_id = :search_id' . $queryClause . '
             ORDER BY comment_date DESC, platform_created_at DESC, created_at DESC
             LIMIT :limit_count OFFSET :offset_count'
        );
        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value);
        }
        $statement->bindValue('limit_count', $perPage, PDO::PARAM_INT);
        $statement->bindValue('offset_count', $offset, PDO::PARAM_INT);
        $statement->execute();

        return [
            'items' => array_map(
                static function (array $row): array {
                    $metadata = json_decode((string) ($row['raw_metadata'] ?? '{}'), true);
                    $commentUsername = (string) ($row['username'] ?? $row['author_name'] ?? '');
                    $videoUsername = (string) ($row['video_username'] ?? '');
                    $keyword = (string) ($row['keyword'] ?? '');
                    $videoUrl = $row['video_url'] ?? null;
                    $shareUrl = $row['share_url'] ?? null;

                    return [
                        'id' => (string) $row['id'],
                        'comment_id' => (string) $row['comment_id'],
                        'content' => (string) $row['comment_text'],
                        'username' => $commentUsername,
                        'created_at' => (string) ($row['platform_created_at'] ?? $row['collected_at']),
                        'video_id' => (string) $row['video_id'],
                        'video_url' => $videoUrl !== null ? (string) $videoUrl : null,
                        'share_url' => $shareUrl !== null ? (string) $shareUrl : null,
                        'video_username' => $videoUsername !== '' ? $videoUsername : null,
                        'keyword' => $keyword,
                        'post_url' => TikTokUrlHelper::buildDirectUrl(
                            $keyword,
                            $shareUrl !== null ? (string) $shareUrl : null,
                            $videoUrl !== null ? (string) $videoUrl : null,
                            $videoUsername !== '' ? $videoUsername : null,
                            (string) $row['video_id']
                        ),
                        'metadata' => is_array($metadata) ? $metadata : [],
                    ];
                },
                $statement->fetchAll()
            ),
            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'from' => $total === 0 ? 0 : ($offset + 1),
                'to' => min($total, $offset + $perPage),
                'last_page' => max(1, (int) ceil($total / $perPage)),
            ],
        ];
    }

    /**
     * @param array<string, string> $params
     */
    private function buildCommentQueryClause(string $query, array &$params): string
    {
        $normalized = trim($query);
        if ($normalized === '') {
            return '';
        }

        $params['comment_query'] = '%' . strtr($normalized, [
            '\\' => '\\\\',
            '%' => '\\%',
            '_' => '\\_',
        ]) . '%';

        return ' AND (
            comment_text LIKE :comment_query ESCAPE "\\\\"
            OR username LIKE :comment_query ESCAPE "\\\\"
            OR author_name LIKE :comment_query ESCAPE "\\\\"
            OR video_username LIKE :comment_query ESCAPE "\\\\"
            OR comment_id LIKE :comment_query ESCAPE "\\\\"
            OR video_id LIKE :comment_query ESCAPE "\\\\"
        )';
    }

    /**
     * @param array<string, string> $params
     */
    private function buildVideoQueryClause(string $query, array &$params): string
    {
        $normalized = trim($query);
        if ($normalized === '') {
            return '';
        }

        $params['video_query'] = '%' . strtr($normalized, [
            '\\' => '\\\\',
            '%' => '\\%',
            '_' => '\\_',
        ]) . '%';

        return ' AND (
            video_id LIKE :video_query ESCAPE "\\\\"
            OR video_username LIKE :video_query ESCAPE "\\\\"
            OR description LIKE :video_query ESCAPE "\\\\"
            OR video_url LIKE :video_query ESCAPE "\\\\"
            OR share_url LIKE :video_query ESCAPE "\\\\"
        )';
    }

    private function ensureCommentColumn(string $columnName, string $definition): void
    {
        $statement = db()->prepare(
            'SELECT 1
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND table_name = "social_listening_comments"
               AND column_name = :column_name
             LIMIT 1'
        );
        $statement->execute(['column_name' => $columnName]);
        $column = $statement->fetch();

        if ($column) {
            return;
        }

        $this->runSchemaStatement(
            sprintf(
                'ALTER TABLE social_listening_comments ADD COLUMN %s %s',
                $columnName,
                $definition
            ),
            [1060]
        );
    }

    private function ensureCommentIndex(string $indexName, string $columnName): void
    {
        $statement = db()->prepare(
            'SELECT 1
             FROM information_schema.statistics
             WHERE table_schema = DATABASE()
               AND table_name = "social_listening_comments"
               AND index_name = :index_name
             LIMIT 1'
        );
        $statement->execute(['index_name' => $indexName]);

        if ($statement->fetch()) {
            return;
        }

        $this->runSchemaStatement(
            sprintf(
                'ALTER TABLE social_listening_comments ADD INDEX %s (%s)',
                $indexName,
                $columnName
            ),
            [1061]
        );
    }

    private function ensureCommentUniqueIndex(): void
    {
        $statement = db()->prepare(
            'SELECT column_name
             FROM information_schema.statistics
             WHERE table_schema = DATABASE()
               AND table_name = "social_listening_comments"
               AND index_name = "uniq_social_platform_comment"
             ORDER BY seq_in_index ASC'
        );
        $statement->execute();
        $columns = array_map(
            static function (array $row): string {
                return (string) $row['column_name'];
            },
            $statement->fetchAll()
        );

        if ($columns === ['platform', 'search_id', 'comment_id']) {
            return;
        }

        if ($columns !== []) {
            $this->runSchemaStatement(
                'ALTER TABLE social_listening_comments DROP INDEX uniq_social_platform_comment',
                [1091]
            );
        }

        $this->runSchemaStatement(
            'ALTER TABLE social_listening_comments
             ADD UNIQUE INDEX uniq_social_platform_comment (platform, search_id, comment_id)',
            [1061]
        );
    }

    /**
     * @param array<int, int> $ignorableMysqlCodes
     */
    private function runSchemaStatement(string $sql, array $ignorableMysqlCodes = []): void
    {
        try {
            db()->exec($sql);
        } catch (PDOException $exception) {
            $mysqlCode = isset($exception->errorInfo[1]) ? (int) $exception->errorInfo[1] : null;
            if ($mysqlCode !== null && in_array($mysqlCode, $ignorableMysqlCodes, true)) {
                return;
            }

            throw $exception;
        }
    }

    private function nullableString($value): ?string
    {
        $normalized = trim((string) $value);
        return $normalized === '' ? null : $normalized;
    }

    private function mapSearchRow(array $row): array
    {
        $meta = json_decode((string) ($row['meta_json'] ?? '{}'), true);

        return [
            'id' => (string) $row['id'],
            'platform' => (string) $row['platform'],
            'keyword' => (string) $row['keyword'],
            'date_from' => (string) $row['date_from'],
            'date_to' => (string) $row['date_to'],
            'status' => (string) $row['status'],
            'provider' => $row['provider'] ? (string) $row['provider'] : null,
            'progress_message' => $row['progress_message'] ? (string) $row['progress_message'] : null,
            'requested_by' => $row['requested_by'] ? (string) $row['requested_by'] : null,
            'total_videos' => (int) $row['total_videos'],
            'total_comments' => (int) $row['total_comments'],
            'queued_jobs' => (int) $row['queued_jobs'],
            'processed_jobs' => (int) $row['processed_jobs'],
            'error_message' => $row['error_message'] ? (string) $row['error_message'] : null,
            'meta' => is_array($meta) ? $meta : [],
            'started_at' => $row['started_at'] ? (string) $row['started_at'] : null,
            'finished_at' => $row['finished_at'] ? (string) $row['finished_at'] : null,
            'created_at' => (string) $row['created_at'],
            'updated_at' => (string) $row['updated_at'],
        ];
    }

    private function mapVideoRow(array $row): array
    {
        $metadata = json_decode((string) ($row['raw_metadata'] ?? '{}'), true);

        return [
            'id' => (string) $row['id'],
            'search_id' => (string) $row['search_id'],
            'video_id' => (string) $row['video_id'],
            'video_url' => $row['video_url'] ? (string) $row['video_url'] : null,
            'share_url' => $row['share_url'] ? (string) $row['share_url'] : null,
            'video_username' => $row['video_username'] ? (string) $row['video_username'] : null,
            'description' => $row['description'] ? (string) $row['description'] : null,
            'published_at' => $row['published_at'] ? (string) $row['published_at'] : null,
            'raw' => is_array($metadata) ? $metadata : [],
        ];
    }

    private function mapJobRow(array $row): array
    {
        $payload = json_decode((string) ($row['payload_json'] ?? '{}'), true);

        return [
            'id' => (int) $row['id'],
            'search_id' => (string) $row['search_id'],
            'job_type' => (string) $row['job_type'],
            'status' => (string) $row['status'],
            'payload' => is_array($payload) ? $payload : [],
            'attempts' => (int) $row['attempts'],
            'max_attempts' => (int) $row['max_attempts'],
            'available_at' => (string) $row['available_at'],
            'locked_at' => $row['locked_at'] ? (string) $row['locked_at'] : null,
            'completed_at' => $row['completed_at'] ? (string) $row['completed_at'] : null,
            'error_message' => $row['error_message'] ? (string) $row['error_message'] : null,
        ];
    }
}
