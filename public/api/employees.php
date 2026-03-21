<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';

function employees_ensure_table(): void
{
    db()->exec(
        'CREATE TABLE IF NOT EXISTS employees (
            id VARCHAR(36) PRIMARY KEY,
            store_id VARCHAR(50) NOT NULL,
            employee_code VARCHAR(100) NOT NULL,
            name VARCHAR(255) NOT NULL,
            role VARCHAR(100) NOT NULL DEFAULT "",
            hourly_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NULL DEFAULT NULL,
            UNIQUE KEY uniq_employee_store_code (store_id, employee_code),
            KEY idx_employee_store (store_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function employees_map_row(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'storeId' => (string) $row['store_id'],
        'employeeCode' => (string) $row['employee_code'],
        'name' => (string) $row['name'],
        'role' => (string) $row['role'],
        'hourlyRate' => (float) $row['hourly_rate'],
        'createdAt' => $row['created_at'],
    ];
}

employees_ensure_table();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    auth_require(['admin']);

    $storeId = trim((string) ($_GET['storeId'] ?? 'cafe'));
    $statement = db()->prepare(
        'SELECT id, store_id, employee_code, name, role, hourly_rate, created_at
         FROM employees
         WHERE store_id = :store_id
         ORDER BY employee_code ASC, name ASC'
    );
    $statement->execute([
        'store_id' => $storeId,
    ]);

    respond_ok([
        'items' => array_map(
            static fn(array $row): array => employees_map_row($row),
            $statement->fetchAll()
        ),
    ]);
}

if ($method === 'POST') {
    auth_require(['admin']);

    $body = read_json_body();
    $storeId = trim((string) ($body['storeId'] ?? 'cafe'));
    $employeeCode = trim((string) ($body['employeeCode'] ?? ''));
    $name = trim((string) ($body['name'] ?? ''));

    if ($employeeCode === '' || $name === '') {
        respond_error('Employee code and name are required', 422);
    }

    $id = uuidv4();
    $statement = db()->prepare(
        'INSERT INTO employees (id, store_id, employee_code, name, role, hourly_rate, created_at)
         VALUES (:id, :store_id, :employee_code, :name, :role, :hourly_rate, NOW())'
    );
    $statement->execute([
        'id' => $id,
        'store_id' => $storeId,
        'employee_code' => $employeeCode,
        'name' => $name,
        'role' => trim((string) ($body['role'] ?? '')),
        'hourly_rate' => (float) ($body['hourlyRate'] ?? 0),
    ]);

    respond_ok([
        'id' => $id,
    ], 201);
}

if ($method === 'PATCH') {
    auth_require(['admin']);

    $body = read_json_body();
    $id = trim((string) ($body['id'] ?? ''));
    if ($id === '') {
        respond_error('Employee id is required', 422);
    }

    $fields = [];
    $params = ['id' => $id];

    if (array_key_exists('employeeCode', $body)) {
        $employeeCode = trim((string) $body['employeeCode']);
        if ($employeeCode === '') {
            respond_error('Employee code is required', 422);
        }
        $fields[] = 'employee_code = :employee_code';
        $params['employee_code'] = $employeeCode;
    }

    if (array_key_exists('name', $body)) {
        $name = trim((string) $body['name']);
        if ($name === '') {
            respond_error('Employee name is required', 422);
        }
        $fields[] = 'name = :name';
        $params['name'] = $name;
    }

    if (array_key_exists('role', $body)) {
        $fields[] = 'role = :role';
        $params['role'] = trim((string) $body['role']);
    }

    if (array_key_exists('hourlyRate', $body)) {
        $fields[] = 'hourly_rate = :hourly_rate';
        $params['hourly_rate'] = (float) $body['hourlyRate'];
    }

    if ($fields === []) {
        respond_error('No changes provided', 422);
    }

    $fields[] = 'updated_at = NOW()';
    $statement = db()->prepare(
        sprintf('UPDATE employees SET %s WHERE id = :id', implode(', ', $fields))
    );
    $statement->execute($params);

    respond_ok([
        'updated' => true,
    ]);
}

if ($method === 'DELETE') {
    auth_require(['admin']);

    $id = trim((string) ($_GET['id'] ?? ''));
    if ($id === '') {
        respond_error('Employee id is required', 422);
    }

    $statement = db()->prepare('DELETE FROM employees WHERE id = :id');
    $statement->execute([
        'id' => $id,
    ]);

    respond_ok([
        'deleted' => true,
    ]);
}

respond_error('Not found', 404);
