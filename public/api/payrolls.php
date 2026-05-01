<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';

function payrolls_ensure_column(string $table, string $column, string $definition): void
{
    if (!preg_match('/^[a-z_]+$/', $table) || !preg_match('/^[a-z_]+$/', $column)) {
        throw new InvalidArgumentException('Invalid table or column name');
    }

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

    if ($statement->fetch()) {
        return;
    }

    db()->exec(sprintf('ALTER TABLE `%s` ADD COLUMN `%s` %s', $table, $column, $definition));
}

function payrolls_has_monthly_signals(array $source): bool
{
    $monthlySalary = (float) ($source['monthlySalary'] ?? ($source['monthly_salary'] ?? 0));
    $fixedSalary = (float) ($source['fixedSalary'] ?? ($source['fixed_salary'] ?? 0));
    $expectedWorkDays = (float) ($source['expectedWorkDays'] ?? ($source['expected_work_days'] ?? 0));
    $standardHours = (float) ($source['standardHours'] ?? ($source['standard_hours'] ?? 0));

    return $monthlySalary > 0 || $fixedSalary > 0 || $expectedWorkDays > 0 || $standardHours > 0;
}

function payrolls_normalize_salary_type(?string $value, array $source = []): string
{
    $normalized = trim((string) $value);
    if ($normalized === 'fixed') {
        return 'monthly';
    }

    if ($normalized === 'monthly' || $normalized === 'hourly') {
        return $normalized;
    }

    return payrolls_has_monthly_signals($source) ? 'monthly' : 'hourly';
}

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
            salary_type VARCHAR(20) NOT NULL DEFAULT "hourly",
            monthly_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
            expected_work_days DECIMAL(10,2) NOT NULL DEFAULT 0,
            paid_leave_days DECIMAL(10,2) NOT NULL DEFAULT 0,
            attendance_bonus_enabled TINYINT(1) NOT NULL DEFAULT 0,
            attendance_bonus_days DECIMAL(10,2) NOT NULL DEFAULT 0,
            attendance_bonus_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
            standard_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
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
            monthly_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
            expected_work_days DECIMAL(10,2) NOT NULL DEFAULT 0,
            paid_leave_days DECIMAL(10,2) NOT NULL DEFAULT 0,
            attendance_bonus_enabled TINYINT(1) NOT NULL DEFAULT 0,
            attendance_bonus_days DECIMAL(10,2) NOT NULL DEFAULT 0,
            attendance_bonus_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
            fixed_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
            standard_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
            shifts_json LONGTEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NULL DEFAULT NULL,
            KEY idx_entry_payroll (payroll_id),
            KEY idx_entry_employee (employee_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    payrolls_ensure_column('employees', 'employee_code', "VARCHAR(100) NOT NULL DEFAULT '' AFTER store_id");
    payrolls_ensure_column('employees', 'salary_type', "VARCHAR(20) NOT NULL DEFAULT 'hourly' AFTER hourly_rate");
    payrolls_ensure_column('employees', 'monthly_salary', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER salary_type');
    payrolls_ensure_column('employees', 'expected_work_days', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER monthly_salary');
    payrolls_ensure_column('employees', 'paid_leave_days', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER expected_work_days');
    payrolls_ensure_column('employees', 'attendance_bonus_enabled', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER paid_leave_days');
    payrolls_ensure_column('employees', 'attendance_bonus_days', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER attendance_bonus_enabled');
    payrolls_ensure_column('employees', 'attendance_bonus_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER attendance_bonus_days');
    payrolls_ensure_column('employees', 'standard_hours', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER attendance_bonus_amount');
    payrolls_ensure_column('payrolls', 'source', "VARCHAR(50) NOT NULL DEFAULT 'manual' AFTER status");
    payrolls_ensure_column('payrolls', 'period_start', 'DATE NULL AFTER source');
    payrolls_ensure_column('payrolls', 'period_end', 'DATE NULL AFTER period_start');
    payrolls_ensure_column('payroll_entries', 'employee_code', "VARCHAR(100) NOT NULL DEFAULT '' AFTER employee_id");
    payrolls_ensure_column('payroll_entries', 'allowances_json', 'LONGTEXT NULL AFTER salary');
    payrolls_ensure_column('payroll_entries', 'monthly_salary', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER salary_type');
    payrolls_ensure_column('payroll_entries', 'expected_work_days', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER monthly_salary');
    payrolls_ensure_column('payroll_entries', 'paid_leave_days', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER expected_work_days');
    payrolls_ensure_column('payroll_entries', 'attendance_bonus_enabled', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER paid_leave_days');
    payrolls_ensure_column('payroll_entries', 'attendance_bonus_days', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER attendance_bonus_enabled');
    payrolls_ensure_column('payroll_entries', 'attendance_bonus_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER attendance_bonus_days');
    payrolls_ensure_column('payroll_entries', 'standard_hours', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER fixed_salary');
    payrolls_ensure_column('payroll_entries', 'shifts_json', 'LONGTEXT NULL AFTER standard_hours');
    db()->exec(
        "UPDATE employees
         SET salary_type = CASE
            WHEN salary_type = 'fixed' THEN 'monthly'
            WHEN TRIM(COALESCE(salary_type, '')) <> '' THEN salary_type
            WHEN COALESCE(monthly_salary, 0) > 0
              OR COALESCE(expected_work_days, 0) > 0
              OR COALESCE(standard_hours, 0) > 0
            THEN 'monthly'
            ELSE 'hourly'
         END"
    );

    db()->exec(
        "UPDATE payroll_entries
         SET salary_type = CASE
            WHEN salary_type = 'fixed' THEN 'monthly'
            WHEN TRIM(COALESCE(salary_type, '')) <> '' THEN salary_type
            WHEN COALESCE(monthly_salary, 0) > 0
              OR COALESCE(fixed_salary, 0) > 0
              OR COALESCE(expected_work_days, 0) > 0
              OR COALESCE(standard_hours, 0) > 0
            THEN 'monthly'
            ELSE 'hourly'
         END"
    );
}
function payrolls_map_row(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'storeId' => (string) $row['store_id'],
        'name' => (string) $row['name'],
        'status' => (string) $row['status'],
        'startDate' => $row['period_start'],
        'endDate' => $row['period_end'],
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
        'salaryType' => payrolls_normalize_salary_type((string) ($row['salary_type'] ?? ''), $row),
        'monthlySalary' => (float) (($row['monthly_salary'] ?? 0) ?: ($row['fixed_salary'] ?? 0)),
        'expectedWorkDays' => (float) ($row['expected_work_days'] ?? 0),
        'paidLeaveDays' => (float) ($row['paid_leave_days'] ?? 0),
        'attendanceBonusEnabled' => (bool) ($row['attendance_bonus_enabled'] ?? false),
        'attendanceBonusDays' => (float) ($row['attendance_bonus_days'] ?? 0),
        'attendanceBonusAmount' => (float) ($row['attendance_bonus_amount'] ?? 0),
        'fixedSalary' => (float) ($row['fixed_salary'] ?? 0),
        'standardHours' => (float) ($row['standard_hours'] ?? 0),
        'shifts' => json_decode((string) ($row['shifts_json'] ?? '[]'), true) ?: [],
    ];
}

function payrolls_upsert_employee(string $storeId, array $employee): string
{
    $employeeId = trim((string) ($employee['employeeId'] ?? $employee['id'] ?? ''));
    $employeeCode = trim((string) ($employee['employeeCode'] ?? ''));
    $name = trim((string) ($employee['employeeName'] ?? $employee['name'] ?? 'Nhan vien'));
    $role = trim((string) ($employee['role'] ?? ''));
    $hourlyRate = (float) ($employee['hourlyRate'] ?? 0);
    $salaryType = payrolls_normalize_salary_type((string) ($employee['salaryType'] ?? ''), $employee);
    $monthlySalary = (float) ($employee['monthlySalary'] ?? ($employee['fixedSalary'] ?? 0));
    $expectedWorkDays = (float) ($employee['expectedWorkDays'] ?? ($salaryType === 'monthly' ? 30 : 0));
    $paidLeaveDays = (float) ($employee['paidLeaveDays'] ?? 0);
    $attendanceBonusEnabled = !empty($employee['attendanceBonusEnabled']) ? 1 : 0;
    $attendanceBonusDays = (float) ($employee['attendanceBonusDays'] ?? 0);
    $attendanceBonusAmount = (float) ($employee['attendanceBonusAmount'] ?? 0);
    $standardHours = (float) ($employee['standardHours'] ?? 0);

    if ($employeeId !== '' && strpos($employeeId, 'manual_') !== 0) {
        $update = db()->prepare(
            'UPDATE employees
             SET employee_code = :employee_code, name = :name, role = :role, hourly_rate = :hourly_rate,
                 salary_type = :salary_type, monthly_salary = :monthly_salary,
                 expected_work_days = :expected_work_days, paid_leave_days = :paid_leave_days,
                 attendance_bonus_enabled = :attendance_bonus_enabled,
                 attendance_bonus_days = :attendance_bonus_days,
                 attendance_bonus_amount = :attendance_bonus_amount,
                 standard_hours = :standard_hours,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $update->execute([
            'id' => $employeeId,
            'employee_code' => $employeeCode,
            'name' => $name,
            'role' => $role,
            'hourly_rate' => $hourlyRate,
            'salary_type' => $salaryType,
            'monthly_salary' => $monthlySalary,
            'expected_work_days' => $expectedWorkDays,
            'paid_leave_days' => $paidLeaveDays,
            'attendance_bonus_enabled' => $attendanceBonusEnabled,
            'attendance_bonus_days' => $attendanceBonusDays,
            'attendance_bonus_amount' => $attendanceBonusAmount,
            'standard_hours' => $standardHours,
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
                 SET name = :name, role = :role, hourly_rate = :hourly_rate,
                     salary_type = :salary_type, monthly_salary = :monthly_salary,
                     expected_work_days = :expected_work_days, paid_leave_days = :paid_leave_days,
                     attendance_bonus_enabled = :attendance_bonus_enabled,
                     attendance_bonus_days = :attendance_bonus_days,
                     attendance_bonus_amount = :attendance_bonus_amount,
                     standard_hours = :standard_hours,
                     updated_at = NOW()
                 WHERE id = :id'
            );
            $update->execute([
                'id' => $existingId,
                'name' => $name,
                'role' => $role,
                'hourly_rate' => $hourlyRate,
                'salary_type' => $salaryType,
                'monthly_salary' => $monthlySalary,
                'expected_work_days' => $expectedWorkDays,
                'paid_leave_days' => $paidLeaveDays,
                'attendance_bonus_enabled' => $attendanceBonusEnabled,
                'attendance_bonus_days' => $attendanceBonusDays,
                'attendance_bonus_amount' => $attendanceBonusAmount,
                'standard_hours' => $standardHours,
            ]);
            return $existingId;
        }
    }

    $newId = uuidv4();
    $insert = db()->prepare(
        'INSERT INTO employees (
            id, store_id, employee_code, name, role, hourly_rate, salary_type, monthly_salary,
            expected_work_days, paid_leave_days, attendance_bonus_enabled, attendance_bonus_days,
            attendance_bonus_amount, standard_hours, created_at
         ) VALUES (
            :id, :store_id, :employee_code, :name, :role, :hourly_rate, :salary_type, :monthly_salary,
            :expected_work_days, :paid_leave_days, :attendance_bonus_enabled, :attendance_bonus_days,
            :attendance_bonus_amount, :standard_hours, NOW()
         )'
    );
    $insert->execute([
        'id' => $newId,
        'store_id' => $storeId,
        'employee_code' => $employeeCode !== '' ? $employeeCode : $newId,
        'name' => $name,
        'role' => $role,
        'hourly_rate' => $hourlyRate,
        'salary_type' => $salaryType,
        'monthly_salary' => $monthlySalary,
        'expected_work_days' => $expectedWorkDays,
        'paid_leave_days' => $paidLeaveDays,
        'attendance_bonus_enabled' => $attendanceBonusEnabled,
        'attendance_bonus_days' => $attendanceBonusDays,
        'attendance_bonus_amount' => $attendanceBonusAmount,
        'standard_hours' => $standardHours,
    ]);

    return $newId;
}
function payrolls_insert_entry(string $payrollId, string $employeeId, array $entry): string
{
    $entryId = uuidv4();
    $salaryType = payrolls_normalize_salary_type((string) ($entry['salaryType'] ?? ''), $entry);
    $monthlySalary = (float) ($entry['monthlySalary'] ?? ($entry['fixedSalary'] ?? 0));
    $expectedWorkDays = (float) ($entry['expectedWorkDays'] ?? ($salaryType === 'monthly' ? 30 : 0));

    $statement = db()->prepare(
        'INSERT INTO payroll_entries (
            id, payroll_id, employee_id, employee_code, employee_name, role,
            hourly_rate, total_hours, weekend_hours, salary, allowances_json, note,
            salary_type, monthly_salary, expected_work_days, paid_leave_days,
            attendance_bonus_enabled, attendance_bonus_days, attendance_bonus_amount,
            fixed_salary, standard_hours, shifts_json, created_at
         ) VALUES (
            :id, :payroll_id, :employee_id, :employee_code, :employee_name, :role,
            :hourly_rate, :total_hours, :weekend_hours, :salary, :allowances_json, :note,
            :salary_type, :monthly_salary, :expected_work_days, :paid_leave_days,
            :attendance_bonus_enabled, :attendance_bonus_days, :attendance_bonus_amount,
            :fixed_salary, :standard_hours, :shifts_json, NOW()
         )'
    );
    $statement->execute([
        'id' => $entryId,
        'payroll_id' => $payrollId,
        'employee_id' => $employeeId,
        'employee_code' => trim((string) ($entry['employeeCode'] ?? '')),
        'employee_name' => trim((string) ($entry['employeeName'] ?? 'Nhan vien')),
        'role' => trim((string) ($entry['role'] ?? '')),
        'hourly_rate' => (float) ($entry['hourlyRate'] ?? 0),
        'total_hours' => (float) ($entry['totalHours'] ?? 0),
        'weekend_hours' => (float) ($entry['weekendHours'] ?? 0),
        'salary' => (float) ($entry['salary'] ?? 0),
        'allowances_json' => json_encode($entry['allowances'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'note' => (string) ($entry['note'] ?? ''),
        'salary_type' => $salaryType,
        'monthly_salary' => $monthlySalary,
        'expected_work_days' => $expectedWorkDays,
        'paid_leave_days' => (float) ($entry['paidLeaveDays'] ?? 0),
        'attendance_bonus_enabled' => !empty($entry['attendanceBonusEnabled']) ? 1 : 0,
        'attendance_bonus_days' => (float) ($entry['attendanceBonusDays'] ?? 0),
        'attendance_bonus_amount' => (float) ($entry['attendanceBonusAmount'] ?? 0),
        'fixed_salary' => $monthlySalary,
        'standard_hours' => (float) ($entry['standardHours'] ?? 0),
        'shifts_json' => json_encode($entry['shifts'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    return $entryId;
}

payrolls_ensure_tables();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    auth_require(['admin', 'manager']);

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
                static function (array $row): array {
                    return payrolls_map_entry_row($row);
                },
                $statement->fetchAll()
            ),
        ]);
    }

    $storeId = trim((string) ($_GET['storeId'] ?? 'cafe'));
    $statement = db()->prepare(
        'SELECT id, store_id, name, status, period_start, period_end, created_at
         FROM payrolls
         WHERE store_id = :store_id
         ORDER BY created_at DESC'
    );
    $statement->execute([
        'store_id' => $storeId,
    ]);

    respond_ok([
        'items' => array_map(
            static function (array $row): array {
                return payrolls_map_row($row);
            },
            $statement->fetchAll()
        ),
    ]);
}

if ($method === 'POST') {
    auth_require(['admin', 'manager']);

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
                $salaryType = payrolls_normalize_salary_type((string) ($employee['salaryType'] ?? ''), $employee);
                $monthlySalary = (float) ($employee['monthlySalary'] ?? 0);
                $entry = [
                    'employeeId' => $employeeId !== '' ? $employeeId : uuidv4(),
                    'employeeCode' => (string) ($employee['employeeCode'] ?? ''),
                    'employeeName' => (string) ($employee['name'] ?? 'Unknown'),
                    'role' => (string) ($employee['role'] ?? ''),
                    'hourlyRate' => (float) ($employee['hourlyRate'] ?? 0),
                    'totalHours' => 0,
                    'weekendHours' => 0,
                    'salary' => 0,
                    'allowances' => is_array($employee['allowances'] ?? null) ? $employee['allowances'] : [],
                    'note' => '',
                    'salaryType' => $salaryType,
                    'monthlySalary' => $monthlySalary,
                    'expectedWorkDays' => (float) ($employee['expectedWorkDays'] ?? ($salaryType === 'monthly' ? 30 : 0)),
                    'paidLeaveDays' => (float) ($employee['paidLeaveDays'] ?? 0),
                    'attendanceBonusEnabled' => !empty($employee['attendanceBonusEnabled']),
                    'attendanceBonusDays' => (float) ($employee['attendanceBonusDays'] ?? 0),
                    'attendanceBonusAmount' => (float) ($employee['attendanceBonusAmount'] ?? 0),
                    'fixedSalary' => $monthlySalary,
                    'standardHours' => (float) ($employee['standardHours'] ?? 0),
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
    auth_require(['admin', 'manager']);

    $body = read_json_body();
    $resource = trim((string) ($body['resource'] ?? ''));

    if ($resource === 'entry') {
        $id = trim((string) ($body['id'] ?? ''));
        if ($id === '') {
            respond_error('Entry id is required', 422);
        }

        $fieldMap = [
            'employeeId' => 'employee_id',
            'employeeCode' => 'employee_code',
            'employeeName' => 'employee_name',
            'role' => 'role',
            'hourlyRate' => 'hourly_rate',
            'totalHours' => 'total_hours',
            'weekendHours' => 'weekend_hours',
            'salary' => 'salary',
            'note' => 'note',
            'salaryType' => 'salary_type',
            'monthlySalary' => 'monthly_salary',
            'expectedWorkDays' => 'expected_work_days',
            'paidLeaveDays' => 'paid_leave_days',
            'attendanceBonusEnabled' => 'attendance_bonus_enabled',
            'attendanceBonusDays' => 'attendance_bonus_days',
            'attendanceBonusAmount' => 'attendance_bonus_amount',
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
            if ($payloadKey === 'salaryType') {
                $params[$payloadKey] = payrolls_normalize_salary_type((string) $body[$payloadKey], $body);
            } elseif ($payloadKey === 'attendanceBonusEnabled') {
                $params[$payloadKey] = !empty($body[$payloadKey]) ? 1 : 0;
            } elseif ($payloadKey === 'fixedSalary') {
                $params[$payloadKey] = (float) $body[$payloadKey];
            } else {
                $params[$payloadKey] = $body[$payloadKey];
            }
        }

        if (!array_key_exists('salaryType', $body) && payrolls_has_monthly_signals($body)) {
            $fields[] = 'salary_type = :salary_type_sync';
            $params['salary_type_sync'] = 'monthly';
        }

        if (array_key_exists('monthlySalary', $body) && !array_key_exists('fixedSalary', $body)) {
            $fields[] = 'fixed_salary = :fixed_salary_sync';
            $params['fixed_salary_sync'] = (float) $body['monthlySalary'];
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

    if (array_key_exists('startDate', $body)) {
        $fields[] = 'period_start = :period_start';
        $params['period_start'] = $body['startDate'] ?: null;
    }

    if (array_key_exists('endDate', $body)) {
        $fields[] = 'period_end = :period_end';
        $params['period_end'] = $body['endDate'] ?: null;
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
    auth_require(['admin', 'manager']);

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

