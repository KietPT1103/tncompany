<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';

function employee_roles_defaults(string $storeId): array
{
    $common = ['Leader', 'MKT'];
    if ($storeId === 'restaurant') {
        return array_merge(['Bếp', 'Thu ngân bếp', 'Phục vụ bếp', 'Rửa chén'], $common);
    }
    if ($storeId === 'farm') {
        return array_merge(['Chăm sóc thú', 'Thú y', 'Thu ngân farm', 'Soát vé', 'Thời vụ', 'Bán hàng'], $common);
    }
    if ($storeId === 'warehouse') {
        return $common;
    }
    return array_merge(['Phục vụ', 'Pha chế', 'Thu ngân'], $common);
}

function employee_roles_ensure_tables(): void
{
    db()->exec(
        'CREATE TABLE IF NOT EXISTS employee_roles (
            id VARCHAR(36) PRIMARY KEY,
            store_id VARCHAR(50) NOT NULL,
            name VARCHAR(100) NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            is_default TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NULL DEFAULT NULL,
            UNIQUE KEY uniq_employee_role_store_name (store_id, name),
            KEY idx_employee_roles_store_order (store_id, sort_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    db()->exec(
        'CREATE TABLE IF NOT EXISTS employee_role_store_state (
            store_id VARCHAR(50) PRIMARY KEY,
            initialized_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $rolesColumn = db()->prepare(
        'SELECT 1 FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = "employees" AND column_name = "roles_json" LIMIT 1'
    );
    $rolesColumn->execute();
    if (!$rolesColumn->fetchColumn()) {
        db()->exec('ALTER TABLE employees ADD COLUMN roles_json LONGTEXT NULL AFTER role');
    }
}

function employee_roles_membership_sql(string $employeeAlias, string $roleAlias): string
{
    return sprintf(
        '(%1$s.role = %2$s.name OR JSON_CONTAINS(CASE WHEN JSON_VALID(COALESCE(%1$s.roles_json, "[]")) THEN COALESCE(%1$s.roles_json, "[]") ELSE "[]" END, JSON_QUOTE(%2$s.name)))',
        $employeeAlias,
        $roleAlias
    );
}

function employee_roles_initialize_store(string $storeId): void
{
    $state = db()->prepare('INSERT IGNORE INTO employee_role_store_state (store_id) VALUES (:store_id)');
    $state->execute(['store_id' => $storeId]);
    if ($state->rowCount() > 0) {
        $insert = db()->prepare(
            'INSERT IGNORE INTO employee_roles (id, store_id, name, sort_order, is_default)
             VALUES (:id, :store_id, :name, :sort_order, 1)'
        );
        foreach (employee_roles_defaults($storeId) as $index => $name) {
            $insert->execute([
                'id' => uuidv4(),
                'store_id' => $storeId,
                'name' => $name,
                'sort_order' => $index + 1,
            ]);
        }
    }

    $import = db()->prepare(
        'INSERT IGNORE INTO employee_roles (id, store_id, name, sort_order, is_default)
         SELECT UUID(), e.store_id, e.role, 1000, 0
         FROM employees e
         WHERE e.store_id = :store_id AND TRIM(e.role) <> ""
         GROUP BY e.store_id, e.role'
    );
    $import->execute(['store_id' => $storeId]);
}

function employee_roles_table_exists(string $table): bool
{
    $statement = db()->prepare(
        'SELECT 1 FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = :table_name LIMIT 1'
    );
    $statement->execute(['table_name' => $table]);
    return (bool) $statement->fetchColumn();
}

function employee_roles_validate_name(string $name): string
{
    $name = trim(preg_replace('/\s+/u', ' ', $name) ?? '');
    if ($name === '') {
        respond_error('Tên vai trò là bắt buộc.', 422);
    }
    if (mb_strlen($name) > 100) {
        respond_error('Tên vai trò không được vượt quá 100 ký tự.', 422);
    }
    return $name;
}

employee_roles_ensure_tables();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    auth_require_permission(['payroll.access', 'payroll_estimate.access', 'timesheet.access']);
} else {
    auth_require_permission(['payroll.access']);
}

if ($method === 'GET') {
    $storeId = trim((string) ($_GET['storeId'] ?? 'cafe'));
    employee_roles_initialize_store($storeId);
    $statement = db()->prepare(
        'SELECT r.id, r.store_id, r.name, r.sort_order, r.is_default, r.created_at,
                COUNT(e.id) AS employee_count
         FROM employee_roles r
         LEFT JOIN employees e ON e.store_id = r.store_id AND ' . employee_roles_membership_sql('e', 'r') . '
         WHERE r.store_id = :store_id
         GROUP BY r.id, r.store_id, r.name, r.sort_order, r.is_default, r.created_at
         ORDER BY r.sort_order ASC, r.name ASC'
    );
    $statement->execute(['store_id' => $storeId]);
    $items = array_map(static function (array $row): array {
        return [
            'id' => (string) $row['id'],
            'storeId' => (string) $row['store_id'],
            'name' => (string) $row['name'],
            'sortOrder' => (int) $row['sort_order'],
            'isDefault' => (bool) $row['is_default'],
            'employeeCount' => (int) $row['employee_count'],
            'createdAt' => $row['created_at'],
        ];
    }, $statement->fetchAll());
    respond_ok(['items' => $items]);
}

if ($method === 'POST') {
    $body = read_json_body();
    $storeId = trim((string) ($body['storeId'] ?? 'cafe'));
    employee_roles_initialize_store($storeId);
    $name = employee_roles_validate_name((string) ($body['name'] ?? ''));
    $orderStatement = db()->prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM employee_roles WHERE store_id = :store_id');
    $orderStatement->execute(['store_id' => $storeId]);
    try {
        $id = uuidv4();
        $statement = db()->prepare(
            'INSERT INTO employee_roles (id, store_id, name, sort_order) VALUES (:id, :store_id, :name, :sort_order)'
        );
        $statement->execute([
            'id' => $id,
            'store_id' => $storeId,
            'name' => $name,
            'sort_order' => (int) $orderStatement->fetchColumn(),
        ]);
        respond_ok(['id' => $id], 201);
    } catch (PDOException $error) {
        if ((string) $error->getCode() === '23000') {
            respond_error('Vai trò này đã tồn tại.', 409);
        }
        throw $error;
    }
}

if ($method === 'PATCH') {
    $body = read_json_body();
    $id = trim((string) ($body['id'] ?? ''));
    $name = employee_roles_validate_name((string) ($body['name'] ?? ''));
    $find = db()->prepare('SELECT id, store_id, name FROM employee_roles WHERE id = :id LIMIT 1');
    $find->execute(['id' => $id]);
    $role = $find->fetch();
    if (!$role) {
        respond_error('Không tìm thấy vai trò.', 404);
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $update = $pdo->prepare('UPDATE employee_roles SET name = :name, updated_at = NOW() WHERE id = :id');
        $update->execute(['name' => $name, 'id' => $id]);
        $employees = $pdo->prepare('UPDATE employees SET role = :name, updated_at = NOW() WHERE store_id = :store_id AND role = :old_name');
        $employees->execute(['name' => $name, 'store_id' => $role['store_id'], 'old_name' => $role['name']]);
        $employeeRows = $pdo->prepare('SELECT id, role, roles_json FROM employees WHERE store_id = :store_id');
        $employeeRows->execute(['store_id' => $role['store_id']]);
        $updateEmployeeRoles = $pdo->prepare('UPDATE employees SET roles_json = :roles_json, updated_at = NOW() WHERE id = :id');
        foreach ($employeeRows->fetchAll() as $employeeRow) {
            $storedRoles = json_decode((string) ($employeeRow['roles_json'] ?? '[]'), true);
            $storedRoles = is_array($storedRoles) ? $storedRoles : [];
            $changed = false;
            foreach ($storedRoles as $index => $storedRole) {
                if ((string) $storedRole === (string) $role['name']) {
                    $storedRoles[$index] = $name;
                    $changed = true;
                }
            }
            if ($changed) {
                $updateEmployeeRoles->execute([
                    'roles_json' => json_encode(array_values(array_unique($storedRoles)), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'id' => $employeeRow['id'],
                ]);
            }
        }
        if (employee_roles_table_exists('role_start_times')) {
            $settings = $pdo->prepare('UPDATE role_start_times SET role_name = :name, updated_at = NOW() WHERE store_id = :store_id AND role_name = :old_name');
            $settings->execute(['name' => $name, 'store_id' => $role['store_id'], 'old_name' => $role['name']]);
        }
        $pdo->commit();
        respond_ok(['updated' => true]);
    } catch (PDOException $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ((string) $error->getCode() === '23000') {
            respond_error('Vai trò này đã tồn tại.', 409);
        }
        throw $error;
    }
}

if ($method === 'DELETE') {
    $id = trim((string) ($_GET['id'] ?? ''));
    $find = db()->prepare(
        'SELECT r.id, r.store_id, r.name, COUNT(e.id) AS employee_count
         FROM employee_roles r
         LEFT JOIN employees e ON e.store_id = r.store_id AND ' . employee_roles_membership_sql('e', 'r') . '
         WHERE r.id = :id GROUP BY r.id, r.store_id, r.name LIMIT 1'
    );
    $find->execute(['id' => $id]);
    $role = $find->fetch();
    if (!$role) respond_error('Không tìm thấy vai trò.', 404);
    if ((int) $role['employee_count'] > 0) {
        respond_error('Vai trò đang được sử dụng. Hãy chuyển nhân viên sang vai trò khác trước khi xóa.', 409);
    }
    if (employee_roles_table_exists('role_start_times')) {
        $settings = db()->prepare('DELETE FROM role_start_times WHERE store_id = :store_id AND role_name = :name');
        $settings->execute(['store_id' => $role['store_id'], 'name' => $role['name']]);
    }
    $statement = db()->prepare('DELETE FROM employee_roles WHERE id = :id');
    $statement->execute(['id' => $id]);
    respond_ok(['deleted' => true]);
}

respond_error('Not found', 404);
