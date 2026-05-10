<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';

function employees_ensure_column(string $table, string $column, string $definition): void
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

    employees_ensure_column('employees', 'employee_code', "VARCHAR(100) NOT NULL DEFAULT '' AFTER store_id");
    employees_ensure_column('employees', 'salary_type', "VARCHAR(20) NOT NULL DEFAULT 'hourly' AFTER hourly_rate");
    employees_ensure_column('employees', 'monthly_salary', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER salary_type');
    employees_ensure_column('employees', 'expected_work_days', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER monthly_salary');
    employees_ensure_column('employees', 'paid_leave_days', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER expected_work_days');
    employees_ensure_column('employees', 'attendance_bonus_enabled', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER paid_leave_days');
    employees_ensure_column('employees', 'attendance_bonus_days', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER attendance_bonus_enabled');
    employees_ensure_column('employees', 'attendance_bonus_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER attendance_bonus_days');
    employees_ensure_column('employees', 'standard_hours', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER attendance_bonus_amount');
    employees_ensure_column('employees', 'allowances_json', 'LONGTEXT NULL AFTER standard_hours');

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
}

function employees_has_monthly_signals(array $source): bool
{
    $monthlySalary = (float) ($source['monthlySalary'] ?? ($source['monthly_salary'] ?? 0));
    $expectedWorkDays = (float) ($source['expectedWorkDays'] ?? ($source['expected_work_days'] ?? 0));
    $standardHours = (float) ($source['standardHours'] ?? ($source['standard_hours'] ?? 0));

    return $monthlySalary > 0 || $expectedWorkDays > 0 || $standardHours > 0;
}

function employees_normalize_salary_type(?string $value, array $source = []): string
{
    $normalized = trim((string) $value);
    if ($normalized === 'fixed') {
        return 'monthly';
    }

    if ($normalized === 'monthly' || $normalized === 'hourly') {
        return $normalized;
    }

    return employees_has_monthly_signals($source) ? 'monthly' : 'hourly';
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
        'salaryType' => employees_normalize_salary_type((string) ($row['salary_type'] ?? ''), $row),
        'monthlySalary' => (float) ($row['monthly_salary'] ?? 0),
        'expectedWorkDays' => (float) ($row['expected_work_days'] ?? 0),
        'paidLeaveDays' => (float) ($row['paid_leave_days'] ?? 0),
        'attendanceBonusEnabled' => (bool) ($row['attendance_bonus_enabled'] ?? false),
        'attendanceBonusDays' => (float) ($row['attendance_bonus_days'] ?? 0),
        'attendanceBonusAmount' => (float) ($row['attendance_bonus_amount'] ?? 0),
        'standardHours' => (float) ($row['standard_hours'] ?? 0),
        'allowances' => json_decode((string) ($row['allowances_json'] ?? '[]'), true) ?: [],
        'createdAt' => $row['created_at'],
    ];
}
employees_ensure_table();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    auth_require_permission(['payroll.access', 'payroll_estimate.access', 'timesheet.access']);

    $storeId = trim((string) ($_GET['storeId'] ?? 'cafe'));
    $statement = db()->prepare(
        'SELECT id, store_id, employee_code, name, role, hourly_rate, salary_type, monthly_salary,
                expected_work_days, paid_leave_days, attendance_bonus_enabled, attendance_bonus_days,
                attendance_bonus_amount, standard_hours, allowances_json, created_at
         FROM employees
         WHERE store_id = :store_id
         ORDER BY employee_code ASC, name ASC'
    );
    $statement->execute([
        'store_id' => $storeId,
    ]);

    respond_ok([
        'items' => array_map(
            static function (array $row): array {
                return employees_map_row($row);
            },
            $statement->fetchAll()
        ),
    ]);
}

if ($method === 'POST') {
    auth_require_permission(['payroll.access', 'payroll_estimate.access', 'timesheet.access']);

    $body = read_json_body();
    $storeId = trim((string) ($body['storeId'] ?? 'cafe'));
    $employeeCode = trim((string) ($body['employeeCode'] ?? ''));
    $name = trim((string) ($body['name'] ?? ''));

    if ($employeeCode === '' || $name === '') {
        respond_error('Employee code and name are required', 422);
    }

    $salaryType = employees_normalize_salary_type((string) ($body['salaryType'] ?? ''), $body);
    $expectedWorkDays = (float) ($body['expectedWorkDays'] ?? ($salaryType === 'monthly' ? 30 : 0));
    $id = uuidv4();
    $statement = db()->prepare(
        'INSERT INTO employees (
            id, store_id, employee_code, name, role, hourly_rate, salary_type, monthly_salary,
            expected_work_days, paid_leave_days, attendance_bonus_enabled, attendance_bonus_days,
            attendance_bonus_amount, standard_hours, allowances_json, created_at
         ) VALUES (
            :id, :store_id, :employee_code, :name, :role, :hourly_rate, :salary_type, :monthly_salary,
            :expected_work_days, :paid_leave_days, :attendance_bonus_enabled, :attendance_bonus_days,
            :attendance_bonus_amount, :standard_hours, :allowances_json, NOW()
         )'
    );
    $statement->execute([
        'id' => $id,
        'store_id' => $storeId,
        'employee_code' => $employeeCode,
        'name' => $name,
        'role' => trim((string) ($body['role'] ?? '')),
        'hourly_rate' => (float) ($body['hourlyRate'] ?? 0),
        'salary_type' => $salaryType,
        'monthly_salary' => (float) ($body['monthlySalary'] ?? 0),
        'expected_work_days' => $expectedWorkDays,
        'paid_leave_days' => (float) ($body['paidLeaveDays'] ?? 0),
        'attendance_bonus_enabled' => !empty($body['attendanceBonusEnabled']) ? 1 : 0,
        'attendance_bonus_days' => (float) ($body['attendanceBonusDays'] ?? 0),
        'attendance_bonus_amount' => (float) ($body['attendanceBonusAmount'] ?? 0),
        'standard_hours' => (float) ($body['standardHours'] ?? 0),
        'allowances_json' => json_encode($body['allowances'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    respond_ok([
        'id' => $id,
    ], 201);
}

if ($method === 'PATCH') {
    auth_require_permission(['payroll.access', 'payroll_estimate.access', 'timesheet.access']);

    $body = read_json_body();
    $id = trim((string) ($body['id'] ?? ''));
    $storeId = trim((string) ($body['storeId'] ?? ''));
    $employeeCodeFallback = trim((string) ($body['employeeCode'] ?? ''));

    if ($id !== '') {
        $findById = db()->prepare('SELECT id FROM employees WHERE id = :id LIMIT 1');
        $findById->execute(['id' => $id]);
        if (!$findById->fetch()) {
            $id = '';
        }
    }

    if ($id === '' && $storeId !== '' && $employeeCodeFallback !== '') {
        $findByCode = db()->prepare(
            'SELECT id FROM employees WHERE store_id = :store_id AND employee_code = :employee_code LIMIT 1'
        );
        $findByCode->execute([
            'store_id' => $storeId,
            'employee_code' => $employeeCodeFallback,
        ]);
        $id = (string) ($findByCode->fetch()['id'] ?? '');
    }

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

    if (array_key_exists('salaryType', $body)) {
        $fields[] = 'salary_type = :salary_type';
        $params['salary_type'] = employees_normalize_salary_type((string) $body['salaryType'], $body);
    }
    if (!array_key_exists('salaryType', $body) && employees_has_monthly_signals($body)) {
        $fields[] = 'salary_type = :salary_type_sync';
        $params['salary_type_sync'] = 'monthly';
    }


    if (array_key_exists('monthlySalary', $body)) {
        $fields[] = 'monthly_salary = :monthly_salary';
        $params['monthly_salary'] = (float) $body['monthlySalary'];
    }

    if (array_key_exists('expectedWorkDays', $body)) {
        $fields[] = 'expected_work_days = :expected_work_days';
        $params['expected_work_days'] = (float) $body['expectedWorkDays'];
    }

    if (array_key_exists('paidLeaveDays', $body)) {
        $fields[] = 'paid_leave_days = :paid_leave_days';
        $params['paid_leave_days'] = (float) $body['paidLeaveDays'];
    }

    if (array_key_exists('attendanceBonusEnabled', $body)) {
        $fields[] = 'attendance_bonus_enabled = :attendance_bonus_enabled';
        $params['attendance_bonus_enabled'] = !empty($body['attendanceBonusEnabled']) ? 1 : 0;
    }

    if (array_key_exists('attendanceBonusDays', $body)) {
        $fields[] = 'attendance_bonus_days = :attendance_bonus_days';
        $params['attendance_bonus_days'] = (float) $body['attendanceBonusDays'];
    }

    if (array_key_exists('attendanceBonusAmount', $body)) {
        $fields[] = 'attendance_bonus_amount = :attendance_bonus_amount';
        $params['attendance_bonus_amount'] = (float) $body['attendanceBonusAmount'];
    }

    if (array_key_exists('standardHours', $body)) {
        $fields[] = 'standard_hours = :standard_hours';
        $params['standard_hours'] = (float) $body['standardHours'];
    }

    if (array_key_exists('allowances', $body)) {
        $fields[] = 'allowances_json = :allowances_json';
        $params['allowances_json'] = json_encode($body['allowances'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    if ($fields === []) {
        respond_error('No changes provided', 422);
    }

    $fields[] = 'updated_at = NOW()';
    $statement = db()->prepare(
        sprintf('UPDATE employees SET %s WHERE id = :id', implode(', ', $fields))
    );
    $statement->execute($params);

    $verifyStatement = db()->prepare(
        'SELECT id, store_id, employee_code, name, role, hourly_rate, salary_type, monthly_salary,
                expected_work_days, paid_leave_days, attendance_bonus_enabled, attendance_bonus_days,
                attendance_bonus_amount, standard_hours, allowances_json, created_at
         FROM employees
         WHERE id = :id
         LIMIT 1'
    );
    $verifyStatement->execute([
        'id' => $id,
    ]);
    $updatedRow = $verifyStatement->fetch();

    if (!$updatedRow) {
        respond_error('Employee not found after update', 500);
    }

    respond_ok([
        'updated' => true,
        'item' => employees_map_row($updatedRow),
    ]);
}
if ($method === 'DELETE') {
    auth_require_permission(['payroll.access', 'payroll_estimate.access', 'timesheet.access']);

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
