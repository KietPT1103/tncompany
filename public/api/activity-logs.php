<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';

const ACTIVITY_SCREENSHOT_RELATIVE_ROOT = 'uploads/activity-screenshots';
const ACTIVITY_EXPORT_RELATIVE_ROOT = 'uploads/activity-exports';
const ACTIVITY_DOWNLOAD_MAX_FILES = 300;
const ACTIVITY_EXPORT_CHUNK_SIZE = 100;

function activity_has_column(string $table, string $column): bool
{
    $statement = db()->prepare(
        'SELECT COLUMN_NAME
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = :table_name
           AND column_name = :column_name
         LIMIT 1'
    );
    $statement->execute([
        'table_name' => $table,
        'column_name' => $column,
    ]);

    return (bool) $statement->fetch();
}

function activity_ensure_column(string $table, string $column, string $definition): bool
{
    if (activity_has_column($table, $column)) {
        return false;
    }

    db()->exec(sprintf('ALTER TABLE `%s` ADD COLUMN `%s` %s', $table, $column, $definition));
    return true;
}

function activity_ensure_index(string $table, string $indexName, string $definition): void
{
    $statement = db()->prepare(
        'SELECT INDEX_NAME
         FROM information_schema.statistics
         WHERE table_schema = DATABASE()
           AND table_name = :table_name
           AND index_name = :index_name
         LIMIT 1'
    );
    $statement->execute([
        'table_name' => $table,
        'index_name' => $indexName,
    ]);

    if ($statement->fetch()) {
        return;
    }

    db()->exec(sprintf('ALTER TABLE `%s` ADD INDEX `%s` %s', $table, $indexName, $definition));
}

function activity_ensure_tables(): void
{
    db()->exec(
        'CREATE TABLE IF NOT EXISTS activity_machines (
            id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
            machine_id VARCHAR(100) NOT NULL UNIQUE,
            display_name VARCHAR(255) NULL,
            api_key_hash CHAR(64) NOT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            last_seen_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_activity_machines_active (is_active),
            KEY idx_activity_machines_last_seen (last_seen_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    db()->exec(
        'CREATE TABLE IF NOT EXISTS activity_logs (
            id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
            event_id VARCHAR(80) NOT NULL,
            machine_id VARCHAR(100) NOT NULL,
            event_time DATETIME NOT NULL,
            received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            event_type VARCHAR(80) NOT NULL,
            action VARCHAR(80) NULL,
            app_name VARCHAR(255) NULL,
            process_id INT NULL,
            target VARCHAR(1024) NULL,
            details_json LONGTEXT NULL,
            has_screenshot TINYINT(1) NOT NULL DEFAULT 0,
            screenshot_path VARCHAR(500) NULL,
            screenshot_name VARCHAR(255) NULL,
            screenshot_mime VARCHAR(100) NULL,
            UNIQUE KEY uniq_activity_event (machine_id, event_id),
            KEY idx_activity_machine_time (machine_id, event_time),
            KEY idx_activity_type_time (event_type, event_time),
            KEY idx_activity_has_screenshot_time (has_screenshot, event_time, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $hasScreenshotCreated = activity_ensure_column('activity_logs', 'has_screenshot', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER details_json');
    activity_ensure_column('activity_logs', 'screenshot_path', 'VARCHAR(500) NULL AFTER details_json');
    activity_ensure_column('activity_logs', 'screenshot_name', 'VARCHAR(255) NULL AFTER screenshot_path');
    activity_ensure_column('activity_logs', 'screenshot_mime', 'VARCHAR(100) NULL AFTER screenshot_name');
    activity_ensure_index('activity_logs', 'idx_activity_time_id', '(event_time, id)');
    activity_ensure_index('activity_logs', 'idx_activity_has_screenshot_time', '(has_screenshot, event_time, id)');

    if ($hasScreenshotCreated) {
        db()->exec(
            "UPDATE activity_logs
             SET has_screenshot = CASE
                 WHEN screenshot_path IS NOT NULL OR details_json LIKE '%screenshotDataUrl%' THEN 1
                 ELSE 0
             END"
        );
    }
}

function activity_agent_key(): string
{
    $key = $_SERVER['HTTP_X_AGENT_KEY'] ?? '';
    return is_string($key) ? trim($key) : '';
}

function activity_to_sql_datetime($value): string
{
    if (!is_string($value) || trim($value) === '') {
        return (new DateTimeImmutable())->format('Y-m-d H:i:s');
    }

    try {
        return (new DateTimeImmutable($value))->format('Y-m-d H:i:s');
    } catch (Throwable $exception) {
        return (new DateTimeImmutable())->format('Y-m-d H:i:s');
    }
}

function activity_trim_string($value, int $maxLength): ?string
{
    if ($value === null) {
        return null;
    }

    $text = trim((string) $value);
    if ($text === '') {
        return null;
    }

    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $maxLength);
    }

    return substr($text, 0, $maxLength);
}

function activity_require_machine(string $machineId, string $agentKey): array
{
    if ($machineId === '' || $agentKey === '') {
        respond_error('Missing machine id or agent key', 401);
    }

    $statement = db()->prepare(
        'SELECT *
         FROM activity_machines
         WHERE machine_id = :machine_id
           AND is_active = 1
         LIMIT 1'
    );
    $statement->execute([
        'machine_id' => $machineId,
    ]);
    $machine = $statement->fetch();

    if (!$machine || !hash_equals((string) $machine['api_key_hash'], hash('sha256', $agentKey))) {
        respond_error('Invalid machine credentials', 401);
    }

    return $machine;
}

function activity_screenshot_disk_root(): string
{
    return dirname(__DIR__) . DIRECTORY_SEPARATOR . ACTIVITY_SCREENSHOT_RELATIVE_ROOT;
}

function activity_screenshot_relative_directory(DateTimeImmutable $date, string $machineId): string
{
    return ACTIVITY_SCREENSHOT_RELATIVE_ROOT
        . '/' . $date->format('Y-m-d')
        . '/' . activity_safe_name($machineId, 'machine');
}

function activity_screenshot_absolute_path(string $relativePath): string
{
    return dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
}

function activity_export_disk_root(): string
{
    return dirname(__DIR__) . DIRECTORY_SEPARATOR . ACTIVITY_EXPORT_RELATIVE_ROOT;
}

function activity_public_url(string $relativePath): string
{
    return '/' . ltrim(str_replace('\\', '/', $relativePath), '/');
}

function activity_ensure_export_root(): string
{
    $root = activity_export_disk_root();
    if (!is_dir($root) && !mkdir($root, 0775, true) && !is_dir($root)) {
        throw new RuntimeException('Cannot create export directory');
    }

    return $root;
}

function activity_export_job_path(string $jobId): string
{
    return activity_ensure_export_root() . DIRECTORY_SEPARATOR . $jobId . '.json';
}

function activity_export_zip_path(string $jobId): string
{
    return activity_ensure_export_root() . DIRECTORY_SEPARATOR . $jobId . '.zip';
}

function activity_safe_name(string $value, string $fallback): string
{
    $value = trim($value);
    if ($value === '') {
        return $fallback;
    }

    $value = preg_replace('/[<>:"\/\\\\|?*\x00-\x1F]/u', '-', $value) ?? $fallback;
    $value = preg_replace('/\s+/u', ' ', $value) ?? $fallback;
    $value = trim($value, ". \t\n\r\0\x0B");

    if ($value === '') {
        return $fallback;
    }

    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, 120);
    }

    return substr($value, 0, 120);
}

function activity_extension_for_mime(string $mime): string
{
    $map = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'image/bmp' => 'bmp',
    ];

    return $map[strtolower($mime)] ?? 'jpg';
}

function activity_store_screenshot(
    string $machineId,
    string $eventId,
    string $eventTime,
    string $preferredName,
    string $dataUrl
): ?array {
    if (!preg_match('/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s', $dataUrl, $matches)) {
        return null;
    }

    $mime = strtolower($matches[1]);
    $binary = base64_decode($matches[2], true);
    if ($binary === false) {
        return null;
    }

    try {
        $date = new DateTimeImmutable($eventTime);
    } catch (Throwable $exception) {
        $date = new DateTimeImmutable();
    }

    $extension = activity_extension_for_mime($mime);
    $relativeDirectory = activity_screenshot_relative_directory($date, $machineId);
    $absoluteDirectory = activity_screenshot_absolute_path($relativeDirectory);

    if (!is_dir($absoluteDirectory) && !mkdir($absoluteDirectory, 0775, true) && !is_dir($absoluteDirectory)) {
        throw new RuntimeException('Cannot create screenshot directory');
    }

    $relativePath = $relativeDirectory . '/' . $eventId . '.' . $extension;
    $absolutePath = activity_screenshot_absolute_path($relativePath);

    file_put_contents($absolutePath, $binary);

    $downloadName = activity_safe_name($preferredName, 'screenshot') . '.' . $extension;

    return [
        'path' => $relativePath,
        'name' => $downloadName,
        'mime' => $mime,
    ];
}

function activity_delete_screenshot_file(?string $relativePath): void
{
    if (!$relativePath) {
        return;
    }

    $absolutePath = activity_screenshot_absolute_path($relativePath);
    if (is_file($absolutePath)) {
        @unlink($absolutePath);
    }
}

function activity_extract_details(array $row): ?array
{
    if (empty($row['details_json'])) {
        return null;
    }

    $decoded = json_decode((string) $row['details_json'], true);
    return is_array($decoded) ? $decoded : null;
}

function activity_map_log(array $row, bool $includeScreenshot = false): array
{
    $details = activity_extract_details($row);
    $hasScreenshot = isset($row['has_screenshot']) ? (bool) $row['has_screenshot'] : false;
    $hasDetails = isset($row['has_details']) ? (bool) $row['has_details'] : false;

    if (!empty($row['screenshot_path'])) {
        $hasScreenshot = true;
        if ($includeScreenshot) {
            $details = $details ?? [];
            $details['screenshotUrl'] = activity_public_url((string) $row['screenshot_path']);
            $details['screenshotName'] = (string) ($row['screenshot_name'] ?: 'screenshot.jpg');
            $details['screenshotMime'] = (string) ($row['screenshot_mime'] ?: 'image/jpeg');
        }
    } elseif (is_array($details) && !empty($details['screenshotDataUrl']) && is_string($details['screenshotDataUrl'])) {
        $hasScreenshot = true;
        if (!$includeScreenshot) {
            unset($details['screenshotDataUrl']);
        }
    }

    if (!$hasDetails && is_array($details) && count($details) > 0) {
        $hasDetails = true;
    }

    if (is_array($details) && count($details) === 0) {
        $details = null;
    }

    return [
        'id' => (int) $row['id'],
        'eventId' => (string) $row['event_id'],
        'machineId' => (string) $row['machine_id'],
        'eventTime' => (string) $row['event_time'],
        'receivedAt' => (string) $row['received_at'],
        'eventType' => (string) $row['event_type'],
        'action' => $row['action'] ?: null,
        'appName' => $row['app_name'] ?: null,
        'processId' => $row['process_id'] !== null ? (int) $row['process_id'] : null,
        'target' => $row['target'] ?: null,
        'details' => $details,
        'hasScreenshot' => $hasScreenshot,
        'hasDetails' => $hasDetails,
    ];
}

function activity_query_list(string $key): array
{
    $value = $_GET[$key] ?? [];
    $items = [];

    if (is_array($value)) {
        $items = $value;
    } elseif (is_string($value) && trim($value) !== '') {
        $items = explode(',', $value);
    }

    $items = array_map(
        static function ($item): string {
            return trim((string) $item);
        },
        $items
    );

    $items = array_values(
        array_unique(
            array_filter(
                $items,
                static function (string $item): bool {
                    return $item !== '';
                }
            )
        )
    );

    return $items;
}

function activity_query_filters(): array
{
    $eventTypes = activity_query_list('eventTypes');
    $legacyEventType = trim((string) ($_GET['eventType'] ?? ''));
    if ($legacyEventType !== '' && !in_array($legacyEventType, $eventTypes, true)) {
        $eventTypes[] = $legacyEventType;
    }

    return [
        'machineId' => trim((string) ($_GET['machineId'] ?? '')),
        'eventTypes' => $eventTypes,
        'search' => trim((string) ($_GET['search'] ?? '')),
        'startDate' => trim((string) ($_GET['startDate'] ?? '')),
        'endDate' => trim((string) ($_GET['endDate'] ?? '')),
    ];
}

function activity_build_log_conditions(array $filters, bool $onlyWithScreenshot = false): array
{
    $clauses = ['1 = 1'];
    $params = [];

    if (!empty($filters['machineId'])) {
        $clauses[] = 'machine_id = :machine_id';
        $params['machine_id'] = $filters['machineId'];
    }

    if (!empty($filters['eventTypes']) && is_array($filters['eventTypes'])) {
        $placeholders = [];

        foreach (array_values($filters['eventTypes']) as $index => $eventType) {
            $placeholder = 'event_type_' . $index;
            $placeholders[] = ':' . $placeholder;
            $params[$placeholder] = $eventType;
        }

        if ($placeholders !== []) {
            $clauses[] = 'event_type IN (' . implode(', ', $placeholders) . ')';
        }
    }

    if (!empty($filters['search'])) {
        $clauses[] = '(machine_id LIKE :search OR event_type LIKE :search OR action LIKE :search OR app_name LIKE :search OR target LIKE :search)';
        $params['search'] = '%' . $filters['search'] . '%';
    }

    if (!empty($filters['startDate'])) {
        $clauses[] = 'event_time >= :start_date';
        $params['start_date'] = activity_to_sql_datetime($filters['startDate']);
    }

    if (!empty($filters['endDate'])) {
        $clauses[] = 'event_time <= :end_date';
        $params['end_date'] = activity_to_sql_datetime($filters['endDate']);
    }

    if ($onlyWithScreenshot) {
        $clauses[] = 'has_screenshot = 1';
    }

    return [implode(' AND ', $clauses), $params];
}

function activity_extract_legacy_screenshot(array &$details): ?array
{
    $dataUrl = $details['screenshotDataUrl'] ?? null;
    if (!is_string($dataUrl) || trim($dataUrl) === '') {
        return null;
    }

    if (!preg_match('/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s', $dataUrl, $matches)) {
        return null;
    }

    $binary = base64_decode($matches[2], true);
    if ($binary === false) {
        return null;
    }

    unset($details['screenshotDataUrl']);
    return [
        'mime' => strtolower($matches[1]),
        'binary' => $binary,
    ];
}

function activity_zip_entry_name(array &$usedNames, string $machineId, string $preferredName): string
{
    $directory = activity_safe_name($machineId, 'machine');
    $pathInfo = pathinfo($preferredName);
    $filename = $pathInfo['filename'] ?? 'screenshot';
    $extension = isset($pathInfo['extension']) ? '.' . $pathInfo['extension'] : '';
    $candidate = $preferredName;
    $counter = 2;

    while (isset($usedNames[$directory . '/' . $candidate])) {
        $candidate = sprintf('%s (%d)%s', $filename, $counter, $extension);
        $counter += 1;
    }

    $usedNames[$directory . '/' . $candidate] = true;

    return $directory . '/' . $candidate;
}

function activity_zip_add_file(ZipArchive $zip, string $source, string $entryName): bool
{
    $added = $zip->addFile($source, $entryName);
    if ($added && method_exists($zip, 'setCompressionName')) {
        $zip->setCompressionName($entryName, ZipArchive::CM_STORE);
    }

    return $added;
}

function activity_zip_add_binary(ZipArchive $zip, string $entryName, string $binary): bool
{
    $added = $zip->addFromString($entryName, $binary);
    if ($added && method_exists($zip, 'setCompressionName')) {
        $zip->setCompressionName($entryName, ZipArchive::CM_STORE);
    }

    return $added;
}

function activity_stream_download(string $absolutePath, string $contentType, string $downloadName): void
{
    @set_time_limit(0);
    ignore_user_abort(true);

    if (function_exists('session_status') && session_status() === PHP_SESSION_ACTIVE) {
        @session_write_close();
    }

    while (ob_get_level() > 0) {
        @ob_end_clean();
    }

    if (function_exists('apache_setenv')) {
        @apache_setenv('no-gzip', '1');
    }

    @ini_set('zlib.output_compression', '0');
    @ini_set('output_buffering', '0');

    header('Content-Type: ' . $contentType);
    header('Content-Disposition: attachment; filename="' . $downloadName . '"');
    header('Content-Length: ' . (string) filesize($absolutePath));
    header('Content-Transfer-Encoding: binary');
    header('Cache-Control: private, no-transform');
    header('X-Accel-Buffering: no');

    $handle = fopen($absolutePath, 'rb');
    if ($handle === false) {
        respond_error('Cannot open download file', 500);
    }

    while (!feof($handle)) {
        $chunk = fread($handle, 1024 * 1024);
        if ($chunk === false) {
            break;
        }

        echo $chunk;
        flush();
    }

    fclose($handle);
    exit;
}

function activity_export_counts(array $filters): array
{
    [$whereClause, $params] = activity_build_log_conditions($filters, false);

    $storedStatement = db()->prepare(
        'SELECT COUNT(*)
         FROM activity_logs
         WHERE ' . $whereClause . '
           AND screenshot_path IS NOT NULL'
    );
    $storedStatement->execute($params);
    $storedCount = (int) $storedStatement->fetchColumn();

    $legacyStatement = db()->prepare(
        'SELECT COUNT(*)
         FROM activity_logs
         WHERE ' . $whereClause . '
           AND screenshot_path IS NULL
           AND has_screenshot = 1'
    );
    $legacyStatement->execute($params);
    $legacyCount = (int) $legacyStatement->fetchColumn();

    return [
        'stored' => $storedCount,
        'legacy' => $legacyCount,
        'total' => $storedCount + $legacyCount,
    ];
}

function activity_export_entry_name(array $row): string
{
    $seed = (string) ($row['screenshot_name']
        ?: $row['target']
        ?: $row['app_name']
        ?: $row['event_type']
        ?: 'screenshot');
    $safeBase = activity_safe_name(pathinfo($seed, PATHINFO_FILENAME) ?: $seed, 'screenshot');
    $extension = pathinfo((string) ($row['screenshot_name'] ?? ''), PATHINFO_EXTENSION);
    if (!is_string($extension) || $extension === '') {
        $extension = 'jpg';
    }

    $directory = activity_safe_name((string) $row['machine_id'], 'machine');
    $timestamp = preg_replace('/[^0-9]/', '', (string) $row['event_time']) ?: 'capture';
    return sprintf('%s/%s-%s-%d.%s', $directory, $safeBase, $timestamp, (int) $row['id'], $extension);
}

function activity_export_job_public_data(array $job): array
{
    return [
        'jobId' => (string) $job['jobId'],
        'status' => (string) $job['status'],
        'processed' => (int) $job['processed'],
        'total' => (int) $job['total'],
        'archiveName' => (string) $job['archiveName'],
    ];
}

function activity_create_export_job(array $filters): array
{
    $startDate = substr((string) ($filters['startDate'] ?? ''), 0, 10);
    $endDate = substr((string) ($filters['endDate'] ?? ''), 0, 10);
    if ($startDate === '' || $endDate === '' || $startDate !== $endDate) {
        respond_error('Please select exactly one day before downloading screenshots', 422);
    }

    $counts = activity_export_counts($filters);
    if ($counts['total'] === 0) {
        respond_error('No screenshots found for the selected filters', 404);
    }

    $jobId = bin2hex(random_bytes(12));
    $machineName = trim((string) ($filters['machineId'] ?? ''));
    $archiveBase = 'activity-screenshots-' . $startDate;
    if ($machineName !== '') {
        $archiveBase .= '-' . activity_safe_name($machineName, 'machine');
    }
    $job = [
        'jobId' => $jobId,
        'status' => 'queued',
        'filters' => $filters,
        'storedOffset' => 0,
        'legacyOffset' => 0,
        'storedTotal' => $counts['stored'],
        'legacyTotal' => $counts['legacy'],
        'processed' => 0,
        'total' => $counts['total'],
        'archiveName' => $archiveBase . '-' . $jobId . '.zip',
        'createdAt' => (new DateTimeImmutable())->format(DATE_ATOM),
        'updatedAt' => (new DateTimeImmutable())->format(DATE_ATOM),
    ];

    file_put_contents(
        activity_export_job_path($jobId),
        json_encode($job, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    );

    return $job;
}

function activity_read_export_job(string $jobId): array
{
    $jobPath = activity_export_job_path($jobId);
    if (!is_file($jobPath)) {
        respond_error('Export job not found', 404);
    }

    $decoded = json_decode((string) file_get_contents($jobPath), true);
    if (!is_array($decoded)) {
        respond_error('Export job is invalid', 500);
    }

    return $decoded;
}

function activity_write_export_job(array $job): void
{
    $job['updatedAt'] = (new DateTimeImmutable())->format(DATE_ATOM);
    file_put_contents(
        activity_export_job_path((string) $job['jobId']),
        json_encode($job, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    );
}

function activity_fetch_export_chunk(array $filters, string $phase, int $offset, int $limit): array
{
    [$whereClause, $params] = activity_build_log_conditions($filters, false);
    $condition = $phase === 'stored'
        ? 'screenshot_path IS NOT NULL'
        : 'screenshot_path IS NULL AND has_screenshot = 1';

    $statement = db()->prepare(
        'SELECT id, machine_id, event_time, event_type, app_name, target, details_json, screenshot_path, screenshot_name
         FROM activity_logs
         WHERE ' . $whereClause . '
           AND ' . $condition . '
         ORDER BY event_time DESC, id DESC
         LIMIT ' . max(1, $limit) . ' OFFSET ' . max(0, $offset)
    );
    $statement->execute($params);

    return $statement->fetchAll();
}

function activity_process_export_job(string $jobId): array
{
    @set_time_limit(0);
    ignore_user_abort(true);

    $job = activity_read_export_job($jobId);
    if (($job['status'] ?? '') === 'ready') {
        return $job;
    }

    $zip = new ZipArchive();
    if ($zip->open(activity_export_zip_path($jobId), ZipArchive::CREATE) !== true) {
        respond_error('Cannot open export zip archive for writing', 500);
    }

    $remaining = ACTIVITY_EXPORT_CHUNK_SIZE;

    while ($remaining > 0 && (int) $job['storedOffset'] < (int) $job['storedTotal']) {
        $rows = activity_fetch_export_chunk(
            (array) $job['filters'],
            'stored',
            (int) $job['storedOffset'],
            $remaining
        );

        if ($rows === []) {
            $job['storedOffset'] = (int) $job['storedTotal'];
            break;
        }

        foreach ($rows as $row) {
            $absolutePath = dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, (string) $row['screenshot_path']);
            if (is_file($absolutePath)) {
                activity_zip_add_file($zip, $absolutePath, activity_export_entry_name($row));
            }
            $job['storedOffset'] = (int) $job['storedOffset'] + 1;
            $job['processed'] = (int) $job['processed'] + 1;
            $remaining -= 1;

            if ($remaining <= 0) {
                break;
            }
        }
    }

    while ($remaining > 0 && (int) $job['legacyOffset'] < (int) $job['legacyTotal']) {
        $rows = activity_fetch_export_chunk(
            (array) $job['filters'],
            'legacy',
            (int) $job['legacyOffset'],
            $remaining
        );

        if ($rows === []) {
            $job['legacyOffset'] = (int) $job['legacyTotal'];
            break;
        }

        foreach ($rows as $row) {
            $details = activity_extract_details($row) ?? [];
            $legacyScreenshot = activity_extract_legacy_screenshot($details);
            if ($legacyScreenshot) {
                activity_zip_add_binary($zip, activity_export_entry_name($row), $legacyScreenshot['binary']);
            }
            $job['legacyOffset'] = (int) $job['legacyOffset'] + 1;
            $job['processed'] = (int) $job['processed'] + 1;
            $remaining -= 1;

            if ($remaining <= 0) {
                break;
            }
        }
    }

    $zip->close();

    if ((int) $job['processed'] >= (int) $job['total']) {
        $job['status'] = 'ready';
    } else {
        $job['status'] = 'processing';
    }

    activity_write_export_job($job);
    return $job;
}

function activity_download_export_job(string $jobId): void
{
    $job = activity_read_export_job($jobId);
    if (($job['status'] ?? '') !== 'ready') {
        respond_error('Export job is not ready yet', 409);
    }

    $zipPath = activity_export_zip_path($jobId);
    if (!is_file($zipPath)) {
        respond_error('Export archive not found', 404);
    }

    activity_stream_download($zipPath, 'application/zip', (string) $job['archiveName']);
}

function activity_count_screenshots(array $filters): int
{
    [$whereClause, $params] = activity_build_log_conditions($filters, false);

    $storedStatement = db()->prepare(
        'SELECT COUNT(*)
         FROM activity_logs
         WHERE ' . $whereClause . '
           AND screenshot_path IS NOT NULL'
    );
    $storedStatement->execute($params);
    $storedCount = (int) $storedStatement->fetchColumn();

    $legacyStatement = db()->prepare(
        'SELECT COUNT(*)
         FROM activity_logs
         WHERE ' . $whereClause . '
           AND screenshot_path IS NULL
           AND has_screenshot = 1'
    );
    $legacyStatement->execute($params);
    $legacyCount = (int) $legacyStatement->fetchColumn();

    return $storedCount + $legacyCount;
}

function activity_clear_screenshots(array $filters): array
{
    $rowsToClean = [];
    [$whereClause, $params] = activity_build_log_conditions($filters, false);

    $storedStatement = db()->prepare(
        'SELECT id, details_json, screenshot_path
         FROM activity_logs
         WHERE ' . $whereClause . '
           AND screenshot_path IS NOT NULL'
    );
    $storedStatement->execute($params);

    while ($row = $storedStatement->fetch()) {
        $rowsToClean[] = [
            'id' => (int) $row['id'],
            'path' => (string) $row['screenshot_path'],
            'details' => activity_extract_details($row) ?? [],
        ];
    }

    $legacyStatement = db()->prepare(
        'SELECT id, details_json, screenshot_path
         FROM activity_logs
         WHERE ' . $whereClause . '
           AND screenshot_path IS NULL
           AND has_screenshot = 1'
    );
    $legacyStatement->execute($params);

    while ($row = $legacyStatement->fetch()) {
        $details = activity_extract_details($row) ?? [];
        if (array_key_exists('screenshotDataUrl', $details)) {
            unset($details['screenshotDataUrl']);
        }

        $rowsToClean[] = [
            'id' => (int) $row['id'],
            'path' => null,
            'details' => $details,
        ];
    }

    if ($rowsToClean === []) {
        return [
            'deletedCount' => 0,
        ];
    }

    $clearStatement = db()->prepare(
        'UPDATE activity_logs
         SET has_screenshot = 0,
             screenshot_path = NULL,
             screenshot_name = NULL,
             screenshot_mime = NULL,
             details_json = :details_json
         WHERE id = :id'
    );

    foreach ($rowsToClean as $rowToClean) {
        if (!empty($rowToClean['path'])) {
            activity_delete_screenshot_file($rowToClean['path']);
        }

        $detailsJson = null;
        if (is_array($rowToClean['details']) && count($rowToClean['details']) > 0) {
            $detailsJson = json_encode(
                $rowToClean['details'],
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
            );
        }

        $clearStatement->execute([
            'id' => $rowToClean['id'],
            'details_json' => $detailsJson,
        ]);
    }

    return [
        'deletedCount' => count($rowsToClean),
    ];
}

function activity_download_zip(array $filters, bool $deleteAfterDownload): void
{
    if (!class_exists('ZipArchive')) {
        respond_error('ZipArchive is not available on the server', 500);
    }

    $machineId = trim((string) ($filters['machineId'] ?? ''));
    if ($machineId === '') {
        respond_error('Please select exactly one machine before downloading screenshots', 422);
    }

    $startDate = substr((string) ($filters['startDate'] ?? ''), 0, 10);
    $endDate = substr((string) ($filters['endDate'] ?? ''), 0, 10);
    if ($startDate === '' || $endDate === '' || $startDate !== $endDate) {
        respond_error('Please select exactly one day before downloading screenshots', 422);
    }

    $screenshotCount = activity_count_screenshots($filters);
    if ($screenshotCount === 0) {
        respond_error('No screenshots found for the selected filters', 404);
    }

    if ($screenshotCount > ACTIVITY_DOWNLOAD_MAX_FILES) {
        respond_error(
            'Too many screenshots for one download. Please narrow the filters to one machine and a smaller set of events.',
            422,
            [
                'count' => $screenshotCount,
                'maxAllowed' => ACTIVITY_DOWNLOAD_MAX_FILES,
            ]
        );
    }

    @set_time_limit(0);
    ignore_user_abort(true);

    [$whereClause, $params] = activity_build_log_conditions($filters, false);

    $zipPath = tempnam(sys_get_temp_dir(), 'activity-shots-');
    if ($zipPath === false) {
        respond_error('Cannot create temporary zip file', 500);
    }

    @unlink($zipPath);
    $zipPath .= '.zip';

    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        respond_error('Cannot open zip archive for writing', 500);
    }

    $usedNames = [];
    $rowsToClean = [];
    $addedFiles = 0;

    $storedStatement = db()->prepare(
        'SELECT id, machine_id, event_time, event_type, app_name, target, details_json, screenshot_path, screenshot_name
         FROM activity_logs
         WHERE ' . $whereClause . '
           AND screenshot_path IS NOT NULL
         ORDER BY event_time DESC, id DESC'
    );
    $storedStatement->execute($params);

    while ($row = $storedStatement->fetch()) {
        $zipNameSeed = (string) ($row['screenshot_name']
            ?: $row['target']
            ?: $row['app_name']
            ?: $row['event_type']
            ?: 'screenshot');
        $zipName = activity_zip_entry_name(
            $usedNames,
            (string) $row['machine_id'],
            activity_safe_name($zipNameSeed, 'screenshot') . '.jpg'
        );

        $absolutePath = dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, (string) $row['screenshot_path']);
        if (!is_file($absolutePath)) {
            continue;
        }

        if (!activity_zip_add_file($zip, $absolutePath, $zipName)) {
            continue;
        }

        if ($deleteAfterDownload) {
            $rowsToClean[] = [
                'id' => (int) $row['id'],
                'path' => (string) $row['screenshot_path'],
                'details' => activity_extract_details($row) ?? [],
            ];
        }

        $addedFiles += 1;
    }

    $legacyStatement = db()->prepare(
        'SELECT id, machine_id, event_time, event_type, app_name, target, details_json, screenshot_path, screenshot_name
         FROM activity_logs
         WHERE ' . $whereClause . '
           AND screenshot_path IS NULL
           AND has_screenshot = 1
         ORDER BY event_time DESC, id DESC'
    );
    $legacyStatement->execute($params);

    while ($row = $legacyStatement->fetch()) {
        $details = activity_extract_details($row) ?? [];
        $legacyScreenshot = activity_extract_legacy_screenshot($details);
        if (!$legacyScreenshot) {
            continue;
        }

        $zipNameSeed = (string) ($row['screenshot_name']
            ?: $row['target']
            ?: $row['app_name']
            ?: $row['event_type']
            ?: 'screenshot');
        $zipName = activity_zip_entry_name(
            $usedNames,
            (string) $row['machine_id'],
            activity_safe_name($zipNameSeed, 'screenshot') . '.jpg'
        );

        if (!activity_zip_add_binary($zip, $zipName, $legacyScreenshot['binary'])) {
            continue;
        }

        if ($deleteAfterDownload) {
            $rowsToClean[] = [
                'id' => (int) $row['id'],
                'path' => null,
                'details' => $details,
            ];
        }

        $addedFiles += 1;
    }

    $zip->close();

    if ($addedFiles === 0) {
        @unlink($zipPath);
        respond_error('No screenshots found for the selected filters', 404);
    }

    $archiveName = 'activity-screenshots-' . (new DateTimeImmutable())->format('Ymd-His') . '.zip';

    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $archiveName . '"');
    header('Content-Length: ' . (string) filesize($zipPath));

    readfile($zipPath);

    if ($deleteAfterDownload && function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }

    if ($deleteAfterDownload) {
        ignore_user_abort(true);
        activity_clear_screenshots([
            'machineId' => $filters['machineId'] ?? '',
            'eventTypes' => $filters['eventTypes'] ?? [],
            'search' => $filters['search'] ?? '',
            'startDate' => $filters['startDate'] ?? '',
            'endDate' => $filters['endDate'] ?? '',
        ]);
    }

    @unlink($zipPath);
    exit;
}

try {
    activity_ensure_tables();
} catch (Throwable $exception) {
    respond_error('Cannot prepare activity log tables', 500, [
        'details' => $exception->getMessage(),
    ]);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    $body = read_json_body();
    $machineId = trim((string) ($body['machineId'] ?? $body['machine_id'] ?? ''));
    activity_require_machine($machineId, activity_agent_key());

    $events = $body['events'] ?? [];
    if (!is_array($events)) {
        respond_error('events must be an array', 422);
    }

    $statement = db()->prepare(
        'INSERT INTO activity_logs (
            event_id, machine_id, event_time, event_type, action, app_name,
            process_id, target, details_json, has_screenshot, screenshot_path, screenshot_name, screenshot_mime
         ) VALUES (
            :event_id, :machine_id, :event_time, :event_type, :action, :app_name,
            :process_id, :target, :details_json, :has_screenshot, :screenshot_path, :screenshot_name, :screenshot_mime
         )
         ON DUPLICATE KEY UPDATE
            received_at = received_at'
    );

    $stored = 0;
    $skipped = 0;

    foreach ($events as $event) {
        if (!is_array($event)) {
            $skipped += 1;
            continue;
        }

        $eventId = activity_trim_string($event['eventId'] ?? $event['event_id'] ?? null, 80);
        $eventType = activity_trim_string($event['eventType'] ?? $event['event_type'] ?? null, 80);
        if ($eventId === null || $eventType === null) {
            $skipped += 1;
            continue;
        }

        $eventTime = activity_to_sql_datetime($event['eventTime'] ?? $event['event_time'] ?? null);
        $details = $event['details'] ?? null;
        $details = is_array($details) ? $details : null;

        $screenshotPath = null;
        $screenshotName = null;
        $screenshotMime = null;

        if (is_array($details) && !empty($details['screenshotDataUrl']) && is_string($details['screenshotDataUrl'])) {
            $preferredName = (string) ($event['target'] ?? $event['appName'] ?? $event['app_name'] ?? $eventType);
            $storedScreenshot = activity_store_screenshot(
                $machineId,
                $eventId,
                $eventTime,
                $preferredName,
                $details['screenshotDataUrl']
            );

            if ($storedScreenshot) {
                $screenshotPath = $storedScreenshot['path'];
                $screenshotName = $storedScreenshot['name'];
                $screenshotMime = $storedScreenshot['mime'];
                unset($details['screenshotDataUrl']);
            }
        }

        $detailsJson = is_array($details) && count($details) > 0
            ? json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            : null;

        $statement->execute([
            'event_id' => $eventId,
            'machine_id' => $machineId,
            'event_time' => $eventTime,
            'event_type' => $eventType,
            'action' => activity_trim_string($event['action'] ?? null, 80),
            'app_name' => activity_trim_string($event['appName'] ?? $event['app_name'] ?? null, 255),
            'process_id' => isset($event['processId']) || isset($event['process_id'])
                ? (int) ($event['processId'] ?? $event['process_id'])
                : null,
            'target' => activity_trim_string($event['target'] ?? null, 1024),
            'details_json' => $detailsJson,
            'has_screenshot' => ($screenshotPath !== null || (is_array($details) && !empty($details['screenshotDataUrl']))) ? 1 : 0,
            'screenshot_path' => $screenshotPath,
            'screenshot_name' => $screenshotName,
            'screenshot_mime' => $screenshotMime,
        ]);

        $stored += 1;
    }

    $update = db()->prepare('UPDATE activity_machines SET last_seen_at = NOW() WHERE machine_id = :machine_id');
    $update->execute([
        'machine_id' => $machineId,
    ]);

    respond_ok([
        'stored' => $stored,
        'skipped' => $skipped,
    ], 202);
}

if ($method === 'GET') {
    auth_require_permission('activity_logs.access');

    $downloadExportJob = trim((string) ($_GET['downloadExportJob'] ?? ''));
    if ($downloadExportJob !== '') {
        activity_download_export_job($downloadExportJob);
    }

    if (($_GET['downloadScreenshots'] ?? '') === '1') {
        activity_download_zip(
            activity_query_filters(),
            (($_GET['deleteAfterDownload'] ?? '') === '1')
        );
    }

    $logId = max(0, (int) ($_GET['id'] ?? 0));
    if ($logId > 0) {
        $statement = db()->prepare('SELECT * FROM activity_logs WHERE id = :id LIMIT 1');
        $statement->execute([
            'id' => $logId,
        ]);
        $row = $statement->fetch();

        if (!$row) {
            respond_error('Activity log not found', 404);
        }

        respond_ok([
            'item' => activity_map_log($row, true),
        ]);
    }

    $filters = activity_query_filters();
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = max(1, min(300, (int) ($_GET['perPage'] ?? $_GET['limit'] ?? 25)));
    $offset = ($page - 1) * $perPage;

    [$whereClause, $params] = activity_build_log_conditions($filters, false);

    $countStatement = db()->prepare(
        'SELECT COUNT(*) FROM activity_logs WHERE ' . $whereClause
    );
    $countStatement->execute($params);
    $total = (int) $countStatement->fetchColumn();
    $lastPage = max(1, (int) ceil($total / $perPage));
    $page = min($page, $lastPage);
    $offset = ($page - 1) * $perPage;

    $sql = 'SELECT
                id,
                event_id,
                machine_id,
                event_time,
                received_at,
                event_type,
                action,
                app_name,
                process_id,
                target,
                screenshot_path,
                has_screenshot,
                CASE
                    WHEN details_json IS NOT NULL AND details_json <> \'\' THEN 1
                    ELSE 0
                END AS has_details
            FROM activity_logs
            WHERE ' . $whereClause . '
            ORDER BY event_time DESC, id DESC
            LIMIT ' . $perPage . ' OFFSET ' . $offset;
    $statement = db()->prepare($sql);
    $statement->execute($params);
    $pageRows = $statement->fetchAll();
    $from = $total > 0 ? $offset + 1 : 0;
    $to = $total > 0 ? $offset + count($pageRows) : 0;

    $machines = db()->query(
        'SELECT machine_id, display_name, is_active, last_seen_at
         FROM activity_machines
         ORDER BY machine_id ASC'
    )->fetchAll();

    respond_ok([
        'items' => array_map(
            static function (array $row): array {
                return activity_map_log($row, false);
            },
            $pageRows
        ),
        'machines' => array_map(
            static function (array $row): array {
                return [
                    'machineId' => (string) $row['machine_id'],
                    'displayName' => $row['display_name'] ?: null,
                    'isActive' => (bool) $row['is_active'],
                    'lastSeenAt' => $row['last_seen_at'] ?: null,
                ];
            },
            $machines
        ),
        'pagination' => [
            'page' => min($page, $lastPage),
            'perPage' => $perPage,
            'total' => $total,
            'lastPage' => $lastPage,
            'from' => $from,
            'to' => $to,
        ],
    ]);
}

if ($method === 'PUT') {
    auth_require_permission('activity_logs.access');

    $body = read_json_body();
    $action = trim((string) ($body['action'] ?? ''));

    if ($action === 'createScreenshotExport') {
        $filters = [
            'machineId' => trim((string) ($body['machineId'] ?? '')),
            'eventTypes' => array_values(
                array_filter(
                    array_map(
                        static function ($item): string {
                            return trim((string) $item);
                        },
                        is_array($body['eventTypes'] ?? null) ? $body['eventTypes'] : []
                    ),
                    static function (string $item): bool {
                        return $item !== '';
                    }
                )
            ),
            'search' => trim((string) ($body['search'] ?? '')),
            'startDate' => trim((string) ($body['startDate'] ?? '')),
            'endDate' => trim((string) ($body['endDate'] ?? '')),
        ];

        respond_ok(activity_export_job_public_data(activity_create_export_job($filters)));
    }
}

if ($method === 'PATCH') {
    auth_require_permission('activity_logs.access');

    $body = read_json_body();
    $action = trim((string) ($body['action'] ?? ''));

    if ($action === 'advanceScreenshotExport') {
        $jobId = trim((string) ($body['jobId'] ?? ''));
        if ($jobId === '') {
            respond_error('Missing export job id', 422);
        }

        respond_ok(activity_export_job_public_data(activity_process_export_job($jobId)));
    }
}

if ($method === 'DELETE') {
    auth_require_permission('activity_logs.access');

    $body = read_json_body();
    $action = trim((string) ($body['action'] ?? $_GET['action'] ?? ''));

    if ($action === 'deleteScreenshots') {
        $filters = [
            'machineId' => trim((string) ($body['machineId'] ?? '')),
            'eventTypes' => array_values(
                array_filter(
                    array_map(
                        static function ($item): string {
                            return trim((string) $item);
                        },
                        is_array($body['eventTypes'] ?? null) ? $body['eventTypes'] : []
                    ),
                    static function (string $item): bool {
                        return $item !== '';
                    }
                )
            ),
            'search' => trim((string) ($body['search'] ?? '')),
            'startDate' => trim((string) ($body['startDate'] ?? '')),
            'endDate' => trim((string) ($body['endDate'] ?? '')),
        ];

        respond_ok(activity_clear_screenshots($filters));
    }
}

respond_error('Not found', 404);
