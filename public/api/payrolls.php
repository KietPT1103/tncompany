<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';

function payrolls_ensure_tables(): void
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

    db()->exec(
        'CREATE TABLE IF NOT EXISTS payrolls (
            id VARCHAR(36) PRIMARY KEY,
            store_id VARCHAR(50) NOT NULL,
            name VARCHAR(255) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT "draft",
            source VARCHAR(50) NOT NULL DEFAULT "manual",
            period_start DATE NULL,
            period_end DATE NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NULL DEFAULT NULL,
            KEY idx_payroll_store (store_id),
            KEY idx_payroll_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    db()->exec(
        'CREATE TABLE IF NOT EXISTS payroll_entries (
            id VARCHAR(36) PRIMARY KEY,
            payroll_id VARCHAR(36) NOT NULL,
            employee_id VARCHAR(36) NOT NULL,
            employee_code VARCHAR(100) NOT NULL DEFAULT "",
            employee_name VARCHAR(255) NOT NULL,
            role VARCHAR(100) NOT NULL DEFAULT "",
            hourly_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
            total_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
            weekend_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
            salary DECIMAL(12,2) NOT NULL DEFAULT 0,
            allowances_json LONGTEXT NULL,
            note TEXT NULL,
            salary_type VARCHAR(20) NOT NULL DEFAULT "hourly",
            fixed_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
            standard_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
            shifts_json LONGTEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NULL DEFAULT NULL,
            KEY idx_entry_payroll (payroll_id),
            KEY idx_entry_employee (employee_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function payrolls_map_row(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'storeId' => (string) $row['store_id'],
        'name' => (string) $row['name'],
        'status' => (string) $row['status'],
        'createdAt' => $row['created_at'],
    ];
}

function payrolls_map_entry_row(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'payrollId' => (string) $row['payroll_id'],
        'employeeId' => (string) $row['employee_id'],
        'employeeCode' => (string) $row['employee_code'],
        'employeeName' => (string) $row['employee_name'],
        'role' => (string) $row['role'],
        'hourlyRate' => (float) $row['hourly_rate'],
        'totalHours' => (float) $row['total_hours'],
        'weekendHours' => (float) $row['weekend_hours'],
        'salary' => (float) $row['salary'],
        'allowances' => json_decode((string) ($row['allowances_json'] ?? '[]'), true) ?: [],
        'note' => (string) ($row['note'] ?? ''),
        'salaryType' => (string) ($row['salary_type'] ?? 'hourly'),
        'fixedSalary' => (float) ($row['fixed_salary'] ?? 0),
        'standardHours' => (float) ($row['standard_hours'] ?? 0),
        'shifts' => json_decode((string) ($row['shifts_json'] ?? '[]'), true) ?: [],
    ];
}

function payrolls_upsert_employee(string $storeId, array $employee): string
{
    $employeeId = trim((string) ($employee['employeeId'] ?? $employee['id'] ?? ''));
    $employeeCode = trim((string) ($employee['employeeCode'] ?? ''));
    $name = trim((string) ($employee['employeeName'] ?? $employee['name'] ?? 'Nhân viên'));
    $role = trim((string) ($employee['role'] ?? ''));
    $hourlyRate = (float) ($employee['hourlyRate'] ?? 0);

    if ($employeeId !== '' && strpos($employeeId, 'manual_') !== 0) {
        $update = db()->prepare(
            'UPDATE employees
             SET employee_code = :employee_code, name = :name, role = :role, hourly_rate = :hourly_rate, updated_at = NOW()
             WHERE id = :id'
        );
        $update->execute([
            'id' => $employeeId,
            'employee_code' => $employeeCode,
            'name' => $name,
            'role' => $role,
            'hourly_rate' => $hourlyRate,
        ]);
        return $employeeId;
    }

    if ($employeeCode !== '') {
        $find = db()->prepare(
            'SELECT id FROM employees
             WHERE store_id = :store_id AND employee_code = :employee_code
             LIMIT 1'
        );
        $find->execute([
            'store_id' => $storeId,
            'employee_code' => $employeeCode,
        ]);
        $existingId = (string) ($find->fetch()['id'] ?? '');
        if ($existingId !== '') {
            $update = db()->prepare(
                'UPDATE employees
                 SET name = :name, role = :role, hourly_rate = :hourly_rate, updated_at = NOW()
                 WHERE id = :id'
            );
            $update->execute([
                'id' => $existingId,
                'name' => $name,
                'role' => $role,
                'hourly_rate' => $hourlyRate,
            ]);
            return $existingId;
        }
    }

    $newId = uuidv4();
    $insert = db()->prepare(
        'INSERT INTO employees (id, store_id, employee_code, name, role, hourly_rate, created_at)
         VALUES (:id, :store_id, :employee_code, :name, :role, :hourly_rate, NOW())'
    );
    $insert->execute([
        'id' => $newId,
        'store_id' => $storeId,
        'employee_code' => $employeeCode !== '' ? $employeeCode : $newId,
        'name' => $name,
        'role' => $role,
        'hourly_rate' => $hourlyRate,
    ]);

    return $newId;
}

function payrolls_insert_entry(string $payrollId, string $employeeId, array $entry): string
{
    $entryId = uuidv4();
    $statement = db()->prepare(
        'INSERT INTO payroll_entries (
            id, payroll_id, employee_id, employee_code, employee_name, role,
            hourly_rate, total_hours, weekend_hours, salary, allowances_json, note,
            salary_type, fixed_salary, standard_hours, shifts_json, created_at
         ) VALUES (
            :id, :payroll_id, :employee_id, :employee_code, :employee_name, :role,
            :hourly_rate, :total_hours, :weekend_hours, :salary, :allowances_json, :note,
            :salary_type, :fixed_salary, :standard_hours, :shifts_json, NOW()
         )'
    );
    $statement->execute([
        'id' => $entryId,
        'payroll_id' => $payrollId,
        'employee_id' => $employeeId,
        'employee_code' => trim((string) ($entry['employeeCode'] ?? '')),
        'employee_name' => trim((string) ($entry['employeeName'] ?? 'Nhân viên')),
        'role' => trim((string) ($entry['role'] ?? '')),
        'hourly_rate' => (float) ($entry['hourlyRate'] ?? 0),
        'total_hours' => (float) ($entry['totalHours'] ?? 0),
        'weekend_hours' => (float) ($entry['weekendHours'] ?? 0),
        'salary' => (float) ($entry['salary'] ?? 0),
        'allowances_json' => json_encode($entry['allowances'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'note' => (string) ($entry['note'] ?? ''),
        'salary_type' => (string) ($entry['salaryType'] ?? 'hourly'),
        'fixed_salary' => (float) ($entry['fixedSalary'] ?? 0),
        'standard_hours' => (float) ($entry['standardHours'] ?? 0),
        'shifts_json' => json_encode($entry['shifts'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    return $entryId;
}

payrolls_ensure_tables();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    auth_require(['admin']);

    $resource = trim((string) ($_GET['resource'] ?? ''));
    if ($resource === 'entries') {
        $payrollId = trim((string) ($_GET['payrollId'] ?? ''));
        if ($payrollId === '') {
            respond_error('Payroll id is required', 422);
        }

        $statement = db()->prepare(
            'SELECT * FROM payroll_entries
             WHERE payroll_id = :payroll_id
             ORDER BY created_at ASC'
        );
        $statement->execute([
            'payroll_id' => $payrollId,
        ]);

        respond_ok([
            'items' => array_map(
                static fn(array $row): array => payrolls_map_entry_row($row),
                $statement->fetchAll()
            ),
        ]);
    }

    $storeId = trim((string) ($_GET['storeId'] ?? 'cafe'));
    $statement = db()->prepare(
        'SELECT id, store_id, name, status, created_at
         FROM payrolls
         WHERE store_id = :store_id
         ORDER BY created_at DESC'
    );
    $statement->execute([
        'store_id' => $storeId,
    ]);

    respond_ok([
        'items' => array_map(
            static fn(array $row): array => payrolls_map_row($row),
            $statement->fetchAll()
        ),
    ]);
}

if ($method === 'POST') {
    auth_require(['admin']);

    $body = read_json_body();
    $resource = trim((string) ($body['resource'] ?? ''));

    if ($resource === 'entry') {
        $payrollId = trim((string) ($body['payrollId'] ?? ''));
        $seed = is_array($body['seed'] ?? null) ? $body['seed'] : [];
        if ($payrollId === '') {
            respond_error('Payroll id is required', 422);
        }

        $entryId = payrolls_insert_entry(
            $payrollId,
            trim((string) ($seed['employeeId'] ?? ('manual_' . time()))),
            $seed
        );

        respond_ok([
            'id' => $entryId,
        ], 201);
    }

    $storeId = trim((string) ($body['storeId'] ?? 'cafe'));
    $name = trim((string) ($body['name'] ?? ''));
    $employees = is_array($body['employees'] ?? null) ? $body['employees'] : [];
    $entries = is_array($body['entries'] ?? null) ? $body['entries'] : [];

    if ($name === '') {
        respond_error('Payroll name is required', 422);
    }

    $payrollId = uuidv4();
    $pdo = db();
    $pdo->beginTransaction();

    try {
        $insertPayroll = $pdo->prepare(
            'INSERT INTO payrolls (id, store_id, name, status, source, period_start, period_end, created_at)
             VALUES (:id, :store_id, :name, :status, :source, :period_start, :period_end, NOW())'
        );
        $insertPayroll->execute([
            'id' => $payrollId,
            'store_id' => $storeId,
            'name' => $name,
            'status' => trim((string) ($body['status'] ?? 'draft')) ?: 'draft',
            'source' => $entries !== [] ? 'timesheet_import' : 'manual',
            'period_start' => $body['startDate'] ?: null,
            'period_end' => $body['endDate'] ?: null,
        ]);

        if ($entries !== []) {
            foreach ($entries as $entry) {
                $employeeId = payrolls_upsert_employee($storeId, $entry);
                payrolls_insert_entry($payrollId, $employeeId, $entry);
            }
        } else {
            foreach ($employees as $employee) {
                $employeeId = trim((string) ($employee['id'] ?? ''));
                $entry = [
                    'employeeId' => $employeeId !== '' ? $employeeId : uuidv4(),
                    'employeeCode' => (string) ($employee['employeeCode'] ?? ''),
                    'employeeName' => (string) ($employee['name'] ?? 'Unknown'),
                    'role' => (string) ($employee['role'] ?? ''),
                    'hourlyRate' => (float) ($employee['hourlyRate'] ?? 0),
                    'totalHours' => 0,
                    'weekendHours' => 0,
                    'salary' => 0,
                    'allowances' => [],
                    'note' => '',
                    'salaryType' => 'hourly',
                    'fixedSalary' => 0,
                    'standardHours' => 0,
                    'shifts' => [],
                ];
                payrolls_insert_entry($payrollId, $entry['employeeId'], $entry);
            }
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    respond_ok([
        'id' => $payrollId,
    ], 201);
}

if ($method === 'PATCH') {
    auth_require(['admin']);

    $body = read_json_body();
    $resource = trim((string) ($body['resource'] ?? ''));

    if ($resource === 'entry') {
        $id = trim((string) ($body['id'] ?? ''));
        if ($id === '') {
            respond_error('Entry id is required', 422);
        }

        $fieldMap = [
            'employeeName' => 'employee_name',
            'role' => 'role',
            'hourlyRate' => 'hourly_rate',
            'totalHours' => 'total_hours',
            'weekendHours' => 'weekend_hours',
            'salary' => 'salary',
            'note' => 'note',
            'salaryType' => 'salary_type',
            'fixedSalary' => 'fixed_salary',
            'standardHours' => 'standard_hours',
        ];

        $fields = [];
        $params = ['id' => $id];
        foreach ($fieldMap as $payloadKey => $column) {
            if (!array_key_exists($payloadKey, $body)) {
                continue;
            }

            $fields[] = sprintf('%s = :%s', $column, $payloadKey);
            $params[$payloadKey] = $body[$payloadKey];
        }

        if (array_key_exists('allowances', $body)) {
            $fields[] = 'allowances_json = :allowances_json';
            $params['allowances_json'] = json_encode($body['allowances'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        if (array_key_exists('shifts', $body)) {
            $fields[] = 'shifts_json = :shifts_json';
            $params['shifts_json'] = json_encode($body['shifts'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        if ($fields === []) {
            respond_error('No changes provided', 422);
        }

        $fields[] = 'updated_at = NOW()';
        $statement = db()->prepare(
            sprintf('UPDATE payroll_entries SET %s WHERE id = :id', implode(', ', $fields))
        );
        $statement->execute($params);

        respond_ok([
            'updated' => true,
        ]);
    }

    $id = trim((string) ($body['id'] ?? ''));
    if ($id === '') {
        respond_error('Payroll id is required', 422);
    }

    $fields = [];
    $params = ['id' => $id];

    if (array_key_exists('name', $body)) {
        $fields[] = 'name = :name';
        $params['name'] = trim((string) $body['name']);
    }

    if (array_key_exists('status', $body)) {
        $fields[] = 'status = :status';
        $params['status'] = trim((string) $body['status']);
    }

    if ($fields === []) {
        respond_error('No changes provided', 422);
    }

    $fields[] = 'updated_at = NOW()';
    $statement = db()->prepare(
        sprintf('UPDATE payrolls SET %s WHERE id = :id', implode(', ', $fields))
    );
    $statement->execute($params);

    respond_ok([
        'updated' => true,
    ]);
}

if ($method === 'DELETE') {
    auth_require(['admin']);

    $entryId = trim((string) ($_GET['entryId'] ?? ''));
    if ($entryId !== '') {
        $statement = db()->prepare('DELETE FROM payroll_entries WHERE id = :id');
        $statement->execute([
            'id' => $entryId,
        ]);

        respond_ok([
            'deleted' => true,
        ]);
    }

    $id = trim((string) ($_GET['id'] ?? ''));
    if ($id === '') {
        respond_error('Payroll id is required', 422);
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $deleteEntries = $pdo->prepare('DELETE FROM payroll_entries WHERE payroll_id = :payroll_id');
        $deleteEntries->execute([
            'payroll_id' => $id,
        ]);

        $deletePayroll = $pdo->prepare('DELETE FROM payrolls WHERE id = :id');
        $deletePayroll->execute([
            'id' => $id,
        ]);

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    respond_ok([
        'deleted' => true,
    ]);
}

respond_error('Not found', 404);
