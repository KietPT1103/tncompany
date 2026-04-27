<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';

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
            UNIQUE KEY uniq_activity_event (machine_id, event_id),
            KEY idx_activity_machine_time (machine_id, event_time),
            KEY idx_activity_type_time (event_type, event_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
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

function activity_map_log(array $row, bool $includeScreenshot = false): array
{
    $details = null;
    if (!empty($row['details_json'])) {
        $decoded = json_decode((string) $row['details_json'], true);
        $details = is_array($decoded) ? $decoded : null;
    }

    $hasScreenshot = false;
    if (is_array($details) && !empty($details['screenshotDataUrl']) && is_string($details['screenshotDataUrl'])) {
        $hasScreenshot = true;
        if (!$includeScreenshot) {
            unset($details['screenshotDataUrl']);
        }
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
    ];
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
            process_id, target, details_json
         ) VALUES (
            :event_id, :machine_id, :event_time, :event_type, :action, :app_name,
            :process_id, :target, :details_json
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

        $details = $event['details'] ?? null;
        $detailsJson = is_array($details) || is_object($details)
            ? json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            : null;

        $statement->execute([
            'event_id' => $eventId,
            'machine_id' => $machineId,
            'event_time' => activity_to_sql_datetime($event['eventTime'] ?? $event['event_time'] ?? null),
            'event_type' => $eventType,
            'action' => activity_trim_string($event['action'] ?? null, 80),
            'app_name' => activity_trim_string($event['appName'] ?? $event['app_name'] ?? null, 255),
            'process_id' => isset($event['processId']) || isset($event['process_id'])
                ? (int) ($event['processId'] ?? $event['process_id'])
                : null,
            'target' => activity_trim_string($event['target'] ?? null, 1024),
            'details_json' => $detailsJson,
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
    auth_require(['admin']);

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

    $machineId = trim((string) ($_GET['machineId'] ?? ''));
    $eventType = trim((string) ($_GET['eventType'] ?? ''));
    $limit = max(1, min(1000, (int) ($_GET['limit'] ?? 200)));
    $offset = max(0, (int) ($_GET['offset'] ?? 0));
    $startDate = trim((string) ($_GET['startDate'] ?? ''));
    $endDate = trim((string) ($_GET['endDate'] ?? ''));

    $sql = 'SELECT * FROM activity_logs WHERE 1 = 1';
    $params = [];

    if ($machineId !== '') {
        $sql .= ' AND machine_id = :machine_id';
        $params['machine_id'] = $machineId;
    }

    if ($eventType !== '') {
        $sql .= ' AND event_type = :event_type';
        $params['event_type'] = $eventType;
    }

    if ($startDate !== '') {
        $sql .= ' AND event_time >= :start_date';
        $params['start_date'] = activity_to_sql_datetime($startDate);
    }

    if ($endDate !== '') {
        $sql .= ' AND event_time <= :end_date';
        $params['end_date'] = activity_to_sql_datetime($endDate);
    }

    $sql .= ' ORDER BY event_time DESC, id DESC LIMIT ' . ($limit + 1) . ' OFFSET ' . $offset;
    $statement = db()->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll();
    $hasMore = count($rows) > $limit;
    $pageRows = $hasMore ? array_slice($rows, 0, $limit) : $rows;

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
        'hasMore' => $hasMore,
        'nextOffset' => $hasMore ? $offset + count($pageRows) : null,
    ]);
}

respond_error('Not found', 404);
