<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';

function role_start_times_ensure_table(): void
{
    db()->exec(
        'CREATE TABLE IF NOT EXISTS role_start_times (
            id VARCHAR(36) PRIMARY KEY,
            store_id VARCHAR(50) NOT NULL,
            role_name VARCHAR(100) NOT NULL,
            start_time CHAR(5) NULL,
            shift_1_start CHAR(5) NULL,
            shift_2_start CHAR(5) NULL,
            shift_3_start CHAR(5) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NULL DEFAULT NULL,
            UNIQUE KEY uniq_role_start_time (store_id, role_name),
            KEY idx_role_start_times_store (store_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $columns = [
        'start_time' => 'CHAR(5) NULL AFTER role_name',
        'shift_1_start' => 'CHAR(5) NULL AFTER start_time',
        'shift_2_start' => 'CHAR(5) NULL AFTER shift_1_start',
        'shift_3_start' => 'CHAR(5) NULL AFTER shift_2_start',
    ];

    foreach ($columns as $column => $definition) {
        $statement = db()->prepare(
            'SELECT COLUMN_NAME
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND table_name = :table_name
               AND column_name = :column_name
             LIMIT 1'
        );
        $statement->execute([
            'table_name' => 'role_start_times',
            'column_name' => $column,
        ]);

        if (!$statement->fetch()) {
            db()->exec(sprintf(
                'ALTER TABLE `role_start_times` ADD COLUMN `%s` %s',
                $column,
                $definition
            ));
        }
    }

    db()->exec(
        "UPDATE role_start_times
         SET shift_1_start = COALESCE(NULLIF(shift_1_start, ''), NULLIF(start_time, ''))
         WHERE (shift_1_start IS NULL OR shift_1_start = '')
           AND start_time IS NOT NULL
           AND start_time <> ''"
    );
}

function role_start_times_is_valid(?string $value): bool
{
    if ($value === null) {
        return false;
    }

    return preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', trim($value)) === 1;
}

function role_start_times_map_row(array $row): array
{
    return [
        'role' => (string) $row['role_name'],
        'shift1Start' => (string) ($row['shift_1_start'] ?? $row['start_time'] ?? ''),
        'shift2Start' => (string) ($row['shift_2_start'] ?? ''),
        'shift3Start' => (string) ($row['shift_3_start'] ?? ''),
    ];
}

role_start_times_ensure_table();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    auth_require_permission(['payroll.access', 'payroll_estimate.access', 'timesheet.access']);

    $storeId = trim((string) ($_GET['storeId'] ?? 'cafe'));
    $statement = db()->prepare(
        'SELECT role_name, start_time, shift_1_start, shift_2_start, shift_3_start
         FROM role_start_times
         WHERE store_id = :store_id
         ORDER BY role_name ASC'
    );
    $statement->execute([
        'store_id' => $storeId,
    ]);

    respond_ok([
        'items' => array_map(
            static function (array $row): array {
                return role_start_times_map_row($row);
            },
            $statement->fetchAll()
        ),
    ]);
}

if ($method === 'PUT') {
    auth_require_permission(['payroll.access', 'payroll_estimate.access', 'timesheet.access']);

    $body = read_json_body();
    $storeId = trim((string) ($body['storeId'] ?? 'cafe'));
    $items = is_array($body['items'] ?? null) ? $body['items'] : [];

    $pdo = db();
    $pdo->beginTransaction();

    try {
        $deleteStatement = $pdo->prepare('DELETE FROM role_start_times WHERE store_id = :store_id');
        $deleteStatement->execute([
            'store_id' => $storeId,
        ]);

        $insertStatement = $pdo->prepare(
            'INSERT INTO role_start_times (
                id, store_id, role_name, start_time, shift_1_start, shift_2_start, shift_3_start, created_at, updated_at
             ) VALUES (
                :id, :store_id, :role_name, :start_time, :shift_1_start, :shift_2_start, :shift_3_start, NOW(), NOW()
             )'
        );

        $normalizedItems = [];
        foreach ($items as $item) {
            $role = trim((string) ($item['role'] ?? ''));
            $shift1Start = trim((string) ($item['shift1Start'] ?? ''));
            $shift2Start = trim((string) ($item['shift2Start'] ?? ''));
            $shift3Start = trim((string) ($item['shift3Start'] ?? ''));

            if ($role === '' || ($shift1Start === '' && $shift2Start === '' && $shift3Start === '')) {
                continue;
            }

            foreach (
                [
                    'Ca 1' => $shift1Start,
                    'Ca 2' => $shift2Start,
                    'Ca 3' => $shift3Start,
                ] as $label => $shiftStart
            ) {
                if ($shiftStart !== '' && !role_start_times_is_valid($shiftStart)) {
                    respond_error(sprintf('Invalid start time for %s - %s', $role, $label), 422);
                }
            }

            $insertStatement->execute([
                'id' => uuidv4(),
                'store_id' => $storeId,
                'role_name' => $role,
                'start_time' => $shift1Start !== '' ? $shift1Start : null,
                'shift_1_start' => $shift1Start !== '' ? $shift1Start : null,
                'shift_2_start' => $shift2Start !== '' ? $shift2Start : null,
                'shift_3_start' => $shift3Start !== '' ? $shift3Start : null,
            ]);

            $normalizedItems[] = [
                'role' => $role,
                'shift1Start' => $shift1Start,
                'shift2Start' => $shift2Start,
                'shift3Start' => $shift3Start,
            ];
        }

        $pdo->commit();

        respond_ok([
            'items' => $normalizedItems,
        ]);
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
}

respond_error('Not found', 404);
