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
            start_time CHAR(5) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NULL DEFAULT NULL,
            UNIQUE KEY uniq_role_start_time (store_id, role_name),
            KEY idx_role_start_times_store (store_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
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
        'startTime' => (string) $row['start_time'],
    ];
}

role_start_times_ensure_table();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    auth_require_permission(['payroll.access', 'payroll_estimate.access', 'timesheet.access']);

    $storeId = trim((string) ($_GET['storeId'] ?? 'cafe'));
    $statement = db()->prepare(
        'SELECT role_name, start_time
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
                id, store_id, role_name, start_time, created_at, updated_at
             ) VALUES (
                :id, :store_id, :role_name, :start_time, NOW(), NOW()
             )'
        );

        $normalizedItems = [];
        foreach ($items as $item) {
            $role = trim((string) ($item['role'] ?? ''));
            $startTime = trim((string) ($item['startTime'] ?? ''));

            if ($role === '' || $startTime === '') {
                continue;
            }

            if (!role_start_times_is_valid($startTime)) {
                respond_error(sprintf('Invalid start time for role %s', $role), 422);
            }

            $insertStatement->execute([
                'id' => uuidv4(),
                'store_id' => $storeId,
                'role_name' => $role,
                'start_time' => $startTime,
            ]);

            $normalizedItems[] = [
                'role' => $role,
                'startTime' => $startTime,
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
