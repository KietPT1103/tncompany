<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/realtime.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$resource = strtolower(trim((string) ($_GET['resource'] ?? '')));
$body = in_array($method, ['POST', 'PUT', 'PATCH'], true) ? read_json_body() : [];
$user = auth_require();

if (($user['role'] ?? '') === 'bartender') {
    $isBarBoardRequest = $resource === 'bar-jobs' && in_array($method, ['GET', 'PATCH'], true);
    $isBarCheckoutRequest =
        ($method === 'GET' && in_array($resource, ['tables', 'surcharges', 'voucher-categories', 'bills', 'live-orders'], true)) ||
        ($method === 'POST' && in_array($resource, ['bills', 'bar-jobs'], true)) ||
        ($method === 'PUT' && $resource === 'live-orders') ||
        ($method === 'DELETE' && $resource === 'live-orders');

    if ($isBarBoardRequest) {
        if (!auth_has_permission($user, 'bar.access')) respond_error('Forbidden', 403);
    } elseif ($isBarCheckoutRequest) {
        if (!auth_has_permission($user, 'bar.checkout')) respond_error('Forbidden', 403);
    } else {
        respond_error('Tài khoản pha chế không được phép thực hiện thao tác này', 403);
    }
} elseif (!auth_has_permission($user, 'bills.access')) {
    respond_error('Forbidden', 403);
}

function pos_timestamp($value): ?array
{
    if ($value === null || $value === '') return null;
    $seconds = strtotime((string) $value);
    return $seconds === false ? null : ['seconds' => $seconds, 'nanoseconds' => 0];
}

function pos_mysql_datetime($value): ?string
{
    if ($value === null || $value === '') return null;
    $seconds = strtotime((string) $value);
    return $seconds === false ? null : date('Y-m-d H:i:s', $seconds);
}

function pos_bool($value, bool $fallback = false): bool
{
    if ($value === null) return $fallback;
    return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? $fallback;
}

function pos_limit($value, int $fallback = 100): int
{
    return max(1, min(2000, (int) ($value ?: $fallback)));
}

function pos_ensure_default_tables(string $storeId): void
{
    if (!in_array($storeId, ['cafe', 'restaurant', 'bakery'], true)) {
        return;
    }

    $statement = db()->prepare(
        'INSERT IGNORE INTO cafe_tables (id,store_id,name,area)
         VALUES (:id,:store_id,:name,:area)'
    );

    for ($number = 1; $number <= 100; $number++) {
        $statement->execute([
            'id' => uuidv4(),
            'store_id' => $storeId,
            'name' => 'T' . str_pad((string) $number, 2, '0', STR_PAD_LEFT),
            'area' => '',
        ]);
    }
}

function pos_resolve_store_id(array $user, string $requestedStoreId): string
{
    $requestedStoreId = trim($requestedStoreId);
    if (($user['role'] ?? '') === 'admin') {
        return $requestedStoreId !== '' ? $requestedStoreId : 'cafe';
    }

    $assignedStoreId = trim((string) ($user['storeId'] ?? ''));
    if ($assignedStoreId === '') {
        respond_error('Tài khoản chưa được gán quầy bán hàng', 403);
    }
    if ($requestedStoreId !== '' && $requestedStoreId !== $assignedStoreId) {
        respond_error('Bạn không được phép truy cập dữ liệu của quầy khác', 403);
    }

    return $assignedStoreId;
}

function pos_assert_record_store(string $table, string $id, array $user, string $storeId): void
{
    if (($user['role'] ?? '') === 'admin') return;

    $allowedTables = [
        'surcharges', 'bills', 'cash_vouchers', 'cashier_shifts',
        'kitchen_print_jobs', 'bar_print_jobs',
    ];
    if (!in_array($table, $allowedTables, true)) {
        throw new InvalidArgumentException('Invalid POS table');
    }

    $statement = db()->prepare("SELECT store_id FROM {$table} WHERE id=:id LIMIT 1");
    $statement->execute(['id' => $id]);
    $recordStoreId = $statement->fetchColumn();
    if ($recordStoreId !== false && (string) $recordStoreId !== $storeId) {
        respond_error('Bạn không được phép thao tác dữ liệu của quầy khác', 403);
    }
}

function pos_default_bill_prefix(string $storeId): string
{
    $prefixes = [
        'cafe' => 'CF',
        'restaurant' => 'BEP',
        'bakery' => 'BANH',
        'farm' => 'FARM',
    ];
    if (isset($prefixes[$storeId])) return $prefixes[$storeId];

    $fallback = substr((string) preg_replace('/[^A-Z0-9]/', '', strtoupper($storeId)), 0, 8);
    return $fallback !== '' ? $fallback : 'BILL';
}

function pos_ensure_bill_sequences_table(): void
{
    db()->exec(
        'CREATE TABLE IF NOT EXISTS bill_sequences (
            store_id VARCHAR(32) PRIMARY KEY,
            prefix VARCHAR(16) NOT NULL,
            last_number BIGINT UNSIGNED NOT NULL DEFAULT 0,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_bill_sequences_prefix (prefix),
            CONSTRAINT fk_bill_sequences_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function pos_ensure_voucher_categories_table(): void
{
    db()->exec(
        'CREATE TABLE IF NOT EXISTS cash_voucher_categories (
            id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
            store_id VARCHAR(32) NOT NULL,
            voucher_type ENUM(\'income\', \'expense\') NOT NULL,
            name VARCHAR(255) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_voucher_category (store_id, voucher_type, name),
            KEY idx_voucher_categories_store_type (store_id, voucher_type),
            CONSTRAINT fk_voucher_categories_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function pos_ensure_shift_device_columns(): void
{
    auth_ensure_column('cashier_shifts', 'opened_by_device_id', 'VARCHAR(100) NULL AFTER open_note');
    auth_ensure_column('cashier_shifts', 'opened_by_device_name', 'VARCHAR(255) NULL AFTER opened_by_device_id');
}

function pos_ensure_bill_order_source_column(): void
{
    auth_ensure_column('bills', 'order_source', "ENUM('pos','bar') NOT NULL DEFAULT 'pos' AFTER cashier_name");
}

function pos_ensure_bar_workflow_columns(): void
{
    $columnStatement = db()->prepare(
        'SELECT COLUMN_NAME FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = :table_name AND column_name = :column_name LIMIT 1'
    );
    $columnStatement->execute(['table_name' => 'bar_print_jobs', 'column_name' => 'workflow_status']);
    $isFirstMigration = !$columnStatement->fetch();

    auth_ensure_column('bar_print_jobs', 'workflow_status', "VARCHAR(20) NOT NULL DEFAULT 'new' AFTER status");
    auth_ensure_column('bar_print_jobs', 'workflow_updated_at', 'DATETIME NULL AFTER workflow_status');
    auth_ensure_column('bar_print_jobs', 'collected_at', 'DATETIME NULL AFTER workflow_updated_at');

    if ($isFirstMigration) {
        db()->exec(
            "UPDATE bar_print_jobs
             SET workflow_status='collected', workflow_updated_at=COALESCE(printed_at, created_at), collected_at=COALESCE(printed_at, created_at)
             WHERE status='printed'"
        );
    }
}

function pos_shift_payload(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'storeId' => (string) $row['store_id'],
        'cashierUid' => (string) $row['cashier_uid'],
        'cashierName' => (string) $row['cashier_name'],
        'shiftType' => (string) $row['shift_type'],
        'status' => (string) $row['status'],
        'openingCash' => (float) $row['opening_cash'],
        'openNote' => $row['open_note'] ?: '',
        'openedByDeviceId' => $row['opened_by_device_id'] ?: '',
        'openedByDeviceName' => $row['opened_by_device_name'] ?: '',
        'openedAt' => pos_timestamp($row['opened_at']),
        'closedAt' => pos_timestamp($row['closed_at']),
        'closingCash' => $row['closing_cash'] !== null ? (float) $row['closing_cash'] : null,
    ];
}

function pos_remember_voucher_category(string $storeId, string $type, string $name): void
{
    $name = trim($name);
    if ($name === '') return;
    db()->prepare(
        'INSERT INTO cash_voucher_categories (store_id,voucher_type,name)
         VALUES (:store_id,:voucher_type,:name)
         ON DUPLICATE KEY UPDATE last_used_at=NOW()'
    )->execute([
        'store_id' => $storeId,
        'voucher_type' => $type === 'expense' ? 'expense' : 'income',
        'name' => $name,
    ]);
}

function pos_next_bill_id(string $storeId): string
{
    $defaultPrefix = pos_default_bill_prefix($storeId);
    db()->prepare(
        'INSERT IGNORE INTO bill_sequences (store_id,prefix,last_number)
         VALUES (:store_id,:prefix,0)'
    )->execute(['store_id' => $storeId, 'prefix' => $defaultPrefix]);

    $statement = db()->prepare('SELECT prefix,last_number FROM bill_sequences WHERE store_id=:store_id FOR UPDATE');
    $statement->execute(['store_id' => $storeId]);
    $sequence = $statement->fetch();
    if (!$sequence) throw new RuntimeException('Cannot initialize bill sequence');

    $prefix = (string) $sequence['prefix'];
    $nextNumber = (int) $sequence['last_number'] + 1;
    $exists = db()->prepare('SELECT 1 FROM bills WHERE id=:id LIMIT 1');
    do {
        $billId = $prefix . str_pad((string) $nextNumber, 7, '0', STR_PAD_LEFT);
        $exists->execute(['id' => $billId]);
        if (!$exists->fetchColumn()) break;
        $nextNumber++;
    } while (true);

    db()->prepare('UPDATE bill_sequences SET last_number=:last_number WHERE store_id=:store_id')->execute([
        'last_number' => $nextNumber,
        'store_id' => $storeId,
    ]);
    return $billId;
}

function pos_polling_response(array $items): void
{
    respond_ok(['items' => $items, 'polledAt' => time()]);
}

function pos_bill_items(array $billIds): array
{
    if ($billIds === []) return [];
    $placeholders = implode(',', array_fill(0, count($billIds), '?'));
    $statement = db()->prepare(
        "SELECT bill_id, menu_id, name, price, quantity, line_total, note,
                base_price, surcharge_per_unit, surcharge_total
         FROM bill_items WHERE bill_id IN ($placeholders) ORDER BY id"
    );
    $statement->execute($billIds);
    $grouped = [];
    foreach ($statement->fetchAll() as $row) {
        $grouped[(string) $row['bill_id']][] = [
            'menuId' => (string) $row['menu_id'],
            'name' => (string) $row['name'],
            'price' => (float) $row['price'],
            'quantity' => (float) $row['quantity'],
            'lineTotal' => (float) $row['line_total'],
            'note' => $row['note'] ?: '',
            'basePrice' => $row['base_price'] !== null ? (float) $row['base_price'] : null,
            'surchargePerUnit' => $row['surcharge_per_unit'] !== null ? (float) $row['surcharge_per_unit'] : null,
            'surchargeTotal' => $row['surcharge_total'] !== null ? (float) $row['surcharge_total'] : null,
        ];
    }
    return $grouped;
}

function pos_bill_surcharges(array $billIds): array
{
    if ($billIds === []) return [];
    $placeholders = implode(',', array_fill(0, count($billIds), '?'));
    $statement = db()->prepare(
        "SELECT bill_id, surcharge_ref_id, name, surcharge_type, value, amount
         FROM bill_surcharges WHERE bill_id IN ($placeholders) ORDER BY id"
    );
    $statement->execute($billIds);
    $grouped = [];
    foreach ($statement->fetchAll() as $row) {
        $grouped[(string) $row['bill_id']][] = [
            'id' => $row['surcharge_ref_id'] ?: '',
            'name' => (string) $row['name'],
            'type' => (string) $row['surcharge_type'],
            'value' => (float) $row['value'],
            'amount' => (float) $row['amount'],
        ];
    }
    return $grouped;
}

function pos_map_bills(array $rows): array
{
    $ids = array_map(static fn(array $row): string => (string) $row['id'], $rows);
    $items = pos_bill_items($ids);
    $surcharges = pos_bill_surcharges($ids);
    return array_map(static function (array $row) use ($items, $surcharges): array {
        $id = (string) $row['id'];
        return [
            'id' => $id,
            'storeId' => (string) $row['store_id'],
            'tableNumber' => (string) $row['table_number'],
            'note' => $row['note'] ?: '',
            'total' => (float) $row['total'],
            'items' => $items[$id] ?? [],
            'subtotalBeforeSurcharge' => $row['subtotal_before_surcharge'] !== null ? (float) $row['subtotal_before_surcharge'] : null,
            'surchargeTotal' => $row['surcharge_total'] !== null ? (float) $row['surcharge_total'] : null,
            'appliedSurcharges' => $surcharges[$id] ?? [],
            'status' => (string) $row['status'],
            'paymentMethod' => (string) $row['payment_method'],
            'cashReceived' => $row['cash_received'] !== null ? (float) $row['cash_received'] : null,
            'changeAmount' => $row['change_amount'] !== null ? (float) $row['change_amount'] : null,
            'shiftId' => $row['shift_id'] ?: '',
            'cashierId' => $row['cashier_id'] ?: '',
            'cashierName' => $row['cashier_name'] ?: '',
            'orderSource' => ($row['order_source'] ?? 'pos') === 'bar' ? 'bar' : 'pos',
            'createdAt' => pos_timestamp($row['created_at']),
            'cancelledAt' => pos_timestamp($row['cancelled_at']),
            'cancelledBy' => $row['cancelled_by'] ?: '',
        ];
    }, $rows);
}

function pos_replace_bill_children(string $billId, array $items, array $surcharges): void
{
    db()->prepare('DELETE FROM bill_items WHERE bill_id=:id')->execute(['id' => $billId]);
    $itemStatement = db()->prepare(
        'INSERT INTO bill_items
         (bill_id,menu_id,name,price,quantity,line_total,note,base_price,surcharge_per_unit,surcharge_total)
         VALUES (:bill_id,:menu_id,:name,:price,:quantity,:line_total,:note,:base_price,:surcharge_per_unit,:surcharge_total)'
    );
    foreach ($items as $item) {
        $itemStatement->execute([
            'bill_id' => $billId,
            'menu_id' => trim((string) ($item['menuId'] ?? '')),
            'name' => trim((string) ($item['name'] ?? '')),
            'price' => (float) ($item['price'] ?? 0),
            'quantity' => (float) ($item['quantity'] ?? 0),
            'line_total' => (float) ($item['lineTotal'] ?? 0),
            'note' => trim((string) ($item['note'] ?? '')),
            'base_price' => isset($item['basePrice']) ? (float) $item['basePrice'] : null,
            'surcharge_per_unit' => isset($item['surchargePerUnit']) ? (float) $item['surchargePerUnit'] : null,
            'surcharge_total' => isset($item['surchargeTotal']) ? (float) $item['surchargeTotal'] : null,
        ]);
    }

    db()->prepare('DELETE FROM bill_surcharges WHERE bill_id=:id')->execute(['id' => $billId]);
    $surchargeStatement = db()->prepare(
        'INSERT INTO bill_surcharges
         (bill_id,surcharge_ref_id,name,surcharge_type,value,amount)
         VALUES (:bill_id,:ref_id,:name,:type,:value,:amount)'
    );
    foreach ($surcharges as $surcharge) {
        $surchargeStatement->execute([
            'bill_id' => $billId,
            'ref_id' => trim((string) ($surcharge['id'] ?? '')) ?: null,
            'name' => trim((string) ($surcharge['name'] ?? '')),
            'type' => ($surcharge['type'] ?? '') === 'fixed' ? 'fixed' : 'percent',
            'value' => (float) ($surcharge['value'] ?? 0),
            'amount' => (float) ($surcharge['amount'] ?? 0),
        ]);
    }
}

function pos_job_items(string $table, array $jobIds): array
{
    if ($jobIds === []) return [];
    $placeholders = implode(',', array_fill(0, count($jobIds), '?'));
    $statement = db()->prepare("SELECT job_id,menu_id,name,quantity,note FROM {$table} WHERE job_id IN ($placeholders) ORDER BY id");
    $statement->execute($jobIds);
    $grouped = [];
    foreach ($statement->fetchAll() as $row) {
        $grouped[(string) $row['job_id']][] = [
            'menuId' => (string) $row['menu_id'],
            'name' => (string) $row['name'],
            'price' => 0,
            'quantity' => (float) $row['quantity'],
            'note' => $row['note'] ?: '',
        ];
    }
    return $grouped;
}

pos_ensure_bill_sequences_table();
pos_ensure_voucher_categories_table();
pos_ensure_shift_device_columns();
$requestedStoreId = trim((string) ($_GET['storeId'] ?? ($body['storeId'] ?? '')));
$posStoreId = pos_resolve_store_id($user, $requestedStoreId);
$_GET['storeId'] = $posStoreId;
$body['storeId'] = $posStoreId;
if ($resource === 'bills') pos_ensure_bill_order_source_column();

if ($method === 'GET' && $resource === 'tables') {
    $storeId = trim((string) ($_GET['storeId'] ?? 'cafe'));
    pos_ensure_default_tables($storeId);
    $statement = db()->prepare('SELECT id,store_id,name,area,created_at FROM cafe_tables WHERE store_id=:store_id ORDER BY name');
    $statement->execute(['store_id' => $storeId]);
    pos_polling_response(array_map(static fn(array $row): array => [
        'id' => (string) $row['id'], 'storeId' => (string) $row['store_id'],
        'name' => (string) $row['name'], 'area' => $row['area'] ?: '', 'active' => true,
        'order' => strtotime((string) $row['created_at']) ?: 0,
    ], $statement->fetchAll()));
}

if ($method === 'POST' && $resource === 'tables') {
    if (($user['role'] ?? '') !== 'admin') {
        respond_error('Chỉ quản trị viên được thêm bàn mới', 403);
    }
    $id = uuidv4();
    db()->prepare('INSERT INTO cafe_tables (id,store_id,name,area) VALUES (:id,:store_id,:name,:area)')->execute([
        'id' => $id, 'store_id' => trim((string) ($body['storeId'] ?? 'cafe')),
        'name' => trim((string) ($body['name'] ?? '')), 'area' => trim((string) ($body['area'] ?? '')),
    ]);
    realtime_publish($posStoreId, 'tables-updated', ['id' => $id, 'action' => 'created']);
    respond_ok(['id' => $id], 201);
}

if ($method === 'GET' && $resource === 'surcharges') {
    $statement = db()->prepare('SELECT * FROM surcharges WHERE store_id=:store_id ORDER BY created_at,name');
    $statement->execute(['store_id' => trim((string) ($_GET['storeId'] ?? 'cafe'))]);
    pos_polling_response(array_map(static fn(array $row): array => [
        'id' => (string) $row['id'], 'storeId' => (string) $row['store_id'], 'name' => (string) $row['name'],
        'type' => (string) $row['surcharge_type'], 'value' => (float) $row['value'], 'isEnabled' => (bool) $row['is_enabled'],
        'createdAt' => pos_timestamp($row['created_at']), 'updatedAt' => pos_timestamp($row['updated_at']),
    ], $statement->fetchAll()));
}

if ($method === 'POST' && $resource === 'surcharges') {
    $id = uuidv4();
    db()->prepare('INSERT INTO surcharges (id,store_id,name,surcharge_type,value,is_enabled) VALUES (:id,:store_id,:name,:type,:value,:enabled)')->execute([
        'id' => $id, 'store_id' => trim((string) ($body['storeId'] ?? 'cafe')), 'name' => trim((string) ($body['name'] ?? '')),
        'type' => ($body['type'] ?? '') === 'fixed' ? 'fixed' : 'percent', 'value' => (float) ($body['value'] ?? 0),
        'enabled' => pos_bool($body['isEnabled'] ?? true, true) ? 1 : 0,
    ]);
    realtime_publish($posStoreId, 'surcharges-updated', ['id' => $id, 'action' => 'created']);
    respond_ok(['id' => $id], 201);
}

if ($method === 'PATCH' && $resource === 'surcharges') {
    $id = trim((string) ($body['id'] ?? ''));
    pos_assert_record_store('surcharges', $id, $user, $posStoreId);
    $fields = []; $params = ['id' => $id];
    foreach (['name' => 'name', 'value' => 'value'] as $key => $column) if (array_key_exists($key, $body)) { $fields[] = "$column=:$key"; $params[$key] = $body[$key]; }
    if (array_key_exists('type', $body)) { $fields[] = 'surcharge_type=:type'; $params['type'] = $body['type'] === 'fixed' ? 'fixed' : 'percent'; }
    if (array_key_exists('isEnabled', $body)) { $fields[] = 'is_enabled=:enabled'; $params['enabled'] = pos_bool($body['isEnabled']) ? 1 : 0; }
    if ($fields !== []) db()->prepare('UPDATE surcharges SET ' . implode(',', $fields) . ' WHERE id=:id')->execute($params);
    realtime_publish($posStoreId, 'surcharges-updated', ['id' => $id, 'action' => 'updated']);
    respond_ok(['updated' => true]);
}

if ($method === 'DELETE' && $resource === 'surcharges') {
    $id = trim((string) ($_GET['id'] ?? ''));
    pos_assert_record_store('surcharges', $id, $user, $posStoreId);
    db()->prepare('DELETE FROM surcharges WHERE id=:id')->execute(['id' => $id]);
    realtime_publish($posStoreId, 'surcharges-updated', ['id' => $id, 'action' => 'deleted']);
    respond_ok(['deleted' => true]);
}

if ($method === 'GET' && $resource === 'bills') {
    $where = ['store_id=:store_id'];
    $params = ['store_id' => $posStoreId];
    if (($user['role'] ?? '') === 'bartender') $where[] = "order_source='bar'";
    if (!pos_bool($_GET['includeCancelled'] ?? false)) $where[] = "status<>'cancelled'";
    if (!empty($_GET['shiftId'])) { $where[] = 'shift_id=:shift_id'; $params['shift_id'] = trim((string) $_GET['shiftId']); }
    if (!empty($_GET['startDate'])) { $where[] = 'created_at>=:start_date'; $params['start_date'] = pos_mysql_datetime($_GET['startDate']); }
    if (!empty($_GET['endDate'])) { $where[] = 'created_at<=:end_date'; $params['end_date'] = pos_mysql_datetime($_GET['endDate']); }
    $limit = pos_limit($_GET['limit'] ?? 100);
    $statement = db()->prepare('SELECT * FROM bills WHERE ' . implode(' AND ', $where) . " ORDER BY created_at DESC LIMIT $limit");
    $statement->execute($params);
    pos_polling_response(pos_map_bills($statement->fetchAll()));
}

if ($method === 'POST' && $resource === 'bills') {
    if (($user['role'] ?? '') === 'bartender' && !auth_has_permission($user, 'bar.checkout')) {
        respond_error('Tài khoản pha chế chưa được cấp quyền bấm bill', 403);
    }
    db()->beginTransaction();
    try {
        $id = pos_next_bill_id($posStoreId);
        db()->prepare(
            'INSERT INTO bills (id,store_id,table_number,note,total,subtotal_before_surcharge,surcharge_total,status,payment_method,cash_received,change_amount,shift_id,cashier_id,cashier_name,order_source)
             VALUES (:id,:store_id,:table_number,:note,:total,:subtotal,:surcharge_total,:status,:payment_method,:cash_received,:change_amount,:shift_id,:cashier_id,:cashier_name,:order_source)'
        )->execute([
            'id' => $id, 'store_id' => trim((string) ($body['storeId'] ?? 'cafe')), 'table_number' => trim((string) ($body['tableNumber'] ?? '')),
            'note' => trim((string) ($body['note'] ?? '')), 'total' => (float) ($body['total'] ?? 0),
            'subtotal' => isset($body['subtotalBeforeSurcharge']) ? (float) $body['subtotalBeforeSurcharge'] : null,
            'surcharge_total' => isset($body['surchargeTotal']) ? (float) $body['surchargeTotal'] : null,
            'status' => ($body['status'] ?? '') === 'cancelled' ? 'cancelled' : 'completed',
            'payment_method' => ($body['paymentMethod'] ?? '') === 'transfer' ? 'transfer' : 'cash',
            'cash_received' => isset($body['cashReceived']) ? (float) $body['cashReceived'] : null,
            'change_amount' => isset($body['changeAmount']) ? (float) $body['changeAmount'] : null,
            'shift_id' => trim((string) ($body['shiftId'] ?? '')) ?: null, 'cashier_id' => trim((string) ($body['cashierId'] ?? '')) ?: null,
            'cashier_name' => trim((string) ($body['cashierName'] ?? '')) ?: null,
            'order_source' => ($user['role'] ?? '') === 'bartender' ? 'bar' : 'pos',
        ]);
        pos_replace_bill_children($id, is_array($body['items'] ?? null) ? $body['items'] : [], is_array($body['appliedSurcharges'] ?? null) ? $body['appliedSurcharges'] : []);
        db()->commit();
    } catch (Throwable $exception) { if (db()->inTransaction()) db()->rollBack(); throw $exception; }
    realtime_publish($posStoreId, 'bill-created', ['id' => $id]);
    respond_ok(['id' => $id], 201);
}

if ($method === 'PATCH' && $resource === 'bills') {
    $id = trim((string) ($body['id'] ?? ''));
    pos_assert_record_store('bills', $id, $user, $posStoreId);
    $userRole = (string) ($user['role'] ?? '');
    if ($userRole === 'server') {
        respond_error('Tài khoản phục vụ không được chỉnh sửa hóa đơn', 403);
    }
    if ($userRole === 'user') {
        $allowedCashierFields = ['id', 'storeId', 'paymentMethod'];
        foreach (array_keys($body) as $field) {
            if (!in_array($field, $allowedCashierFields, true)) {
                respond_error('Thu ngân chỉ được thay đổi phương thức thanh toán', 403);
            }
        }
        if (!isset($body['paymentMethod']) || !in_array($body['paymentMethod'], ['cash', 'transfer'], true)) {
            respond_error('Phương thức thanh toán không hợp lệ', 422);
        }
    }
    $fields = []; $params = ['id' => $id];
    $map = ['tableNumber'=>'table_number','note'=>'note','total'=>'total','subtotalBeforeSurcharge'=>'subtotal_before_surcharge','surchargeTotal'=>'surcharge_total','status'=>'status','paymentMethod'=>'payment_method','cashReceived'=>'cash_received','changeAmount'=>'change_amount','shiftId'=>'shift_id','cashierId'=>'cashier_id','cashierName'=>'cashier_name'];
    foreach ($map as $key => $column) if (array_key_exists($key, $body)) { $fields[] = "$column=:$key"; $params[$key] = $body[$key] === '' ? null : $body[$key]; }
    if (!empty($body['createdAt'])) { $fields[] = 'created_at=:createdAt'; $params['createdAt'] = pos_mysql_datetime($body['createdAt']); }
    if (($body['action'] ?? '') === 'cancel') { $fields[] = "status='cancelled'"; $fields[] = 'cancelled_at=NOW()'; $fields[] = 'cancelled_by=:cancelledBy'; $params['cancelledBy'] = trim((string) ($body['cancelledBy'] ?? '')); }
    db()->beginTransaction();
    try {
        if ($fields !== []) db()->prepare('UPDATE bills SET ' . implode(',', $fields) . ' WHERE id=:id')->execute($params);
        if (array_key_exists('items', $body) || array_key_exists('appliedSurcharges', $body)) {
            pos_replace_bill_children($id, is_array($body['items'] ?? null) ? $body['items'] : [], is_array($body['appliedSurcharges'] ?? null) ? $body['appliedSurcharges'] : []);
        }
        db()->commit();
    } catch (Throwable $exception) { if (db()->inTransaction()) db()->rollBack(); throw $exception; }
    realtime_publish($posStoreId, 'bill-updated', ['id' => $id]);
    respond_ok(['updated' => true]);
}

if ($method === 'DELETE' && $resource === 'bills') {
    if (($user['role'] ?? '') !== 'admin') {
        respond_error('Chỉ quản trị viên được xóa hóa đơn', 403);
    }
    $id = trim((string) ($_GET['id'] ?? ''));
    pos_assert_record_store('bills', $id, $user, $posStoreId);
    db()->beginTransaction();
    try {
        db()->prepare('UPDATE kitchen_print_jobs SET bill_id=NULL WHERE bill_id=:id')->execute(['id' => $id]);
        db()->prepare('UPDATE bar_print_jobs SET bill_id=NULL WHERE bill_id=:id')->execute(['id' => $id]);
        db()->prepare('DELETE FROM bills WHERE id=:id')->execute(['id' => $id]);
        db()->commit();
    } catch (Throwable $exception) { if (db()->inTransaction()) db()->rollBack(); throw $exception; }
    realtime_publish($posStoreId, 'bill-deleted', ['id' => $id]);
    respond_ok(['deleted' => true]);
}

if ($method === 'GET' && $resource === 'voucher-categories') {
    $categoryWhere = ['store_id=:category_store_id'];
    $historyWhere = ['store_id=:history_store_id', "TRIM(category)<>''"];
    $categoryParams = ['category_store_id' => $posStoreId];
    $historyParams = ['history_store_id' => $posStoreId];
    if (in_array($_GET['type'] ?? '', ['income', 'expense'], true)) {
        $categoryWhere[] = 'voucher_type=:category_type';
        $historyWhere[] = 'voucher_type=:history_type';
        $categoryParams['category_type'] = $_GET['type'];
        $historyParams['history_type'] = $_GET['type'];
    }

    // Read the two sources independently. Some older production tables use a
    // different collation; asking MySQL to UNION them raises error 1271.
    $categoryStatement = db()->prepare(
        'SELECT store_id,voucher_type,name FROM cash_voucher_categories WHERE ' . implode(' AND ', $categoryWhere)
    );
    $categoryStatement->execute($categoryParams);
    $historyStatement = db()->prepare(
        'SELECT store_id,voucher_type,category AS name FROM cash_vouchers WHERE ' . implode(' AND ', $historyWhere)
    );
    $historyStatement->execute($historyParams);

    $categoryRows = [];
    foreach (array_merge($categoryStatement->fetchAll(), $historyStatement->fetchAll()) as $row) {
        $name = trim((string) ($row['name'] ?? ''));
        if ($name === '') continue;
        $normalizedName = function_exists('mb_strtolower') ? mb_strtolower($name, 'UTF-8') : strtolower($name);
        $key = (string) $row['store_id'] . '|' . (string) $row['voucher_type'] . '|' . $normalizedName;
        $categoryRows[$key] = [...$row, 'name' => $name];
    }
    $categoryRows = array_values($categoryRows);
    usort($categoryRows, static fn(array $left, array $right): int => strnatcasecmp((string) $left['name'], (string) $right['name']));

    pos_polling_response(array_map(static fn(array $row): array => [
        'id' => hash('sha256', (string) $row['store_id'] . '|' . (string) $row['voucher_type'] . '|' . (string) $row['name']),
        'storeId' => (string) $row['store_id'],
        'type' => (string) $row['voucher_type'],
        'name' => (string) $row['name'],
    ], $categoryRows));
}

if ($method === 'GET' && $resource === 'vouchers') {
    $where = ['store_id=:store_id']; $params = ['store_id' => trim((string) ($_GET['storeId'] ?? 'cafe'))];
    if (!empty($_GET['shiftId'])) { $where[] = 'shift_id=:shift_id'; $params['shift_id'] = trim((string) $_GET['shiftId']); }
    if (!empty($_GET['startDate'])) { $where[] = 'happened_at>=:start_date'; $params['start_date'] = pos_mysql_datetime($_GET['startDate']); }
    if (!empty($_GET['endDate'])) { $where[] = 'happened_at<=:end_date'; $params['end_date'] = pos_mysql_datetime($_GET['endDate']); }
    $limit = pos_limit($_GET['limit'] ?? 500, 500);
    $statement = db()->prepare('SELECT * FROM cash_vouchers WHERE ' . implode(' AND ', $where) . " ORDER BY happened_at DESC LIMIT $limit"); $statement->execute($params);
    pos_polling_response(array_map(static fn(array $row): array => [
        'id'=>(string)$row['id'],'code'=>(string)$row['code'],'storeId'=>(string)$row['store_id'],'type'=>(string)$row['voucher_type'],
        'amount'=>(float)$row['amount'],'category'=>(string)$row['category'],'note'=>$row['note']?:'',
        'personName'=>$row['person_name']?:'','includeInCashFlow'=>(bool)$row['include_in_cash_flow'],'shiftId'=>$row['shift_id']?:'',
        'cashierId'=>$row['cashier_id']?:'','cashierName'=>$row['cashier_name']?:'','happenedAt'=>pos_timestamp($row['happened_at']),'createdAt'=>pos_timestamp($row['created_at']),
    ], $statement->fetchAll()));
}

if ($method === 'POST' && $resource === 'vouchers') {
    $id=uuidv4(); $type=($body['type']??'')==='expense'?'expense':'income'; $prefix=$type==='income'?'TTHD':'CTM';
    $code=$prefix.date('ymd').str_pad((string)random_int(0,999999),6,'0',STR_PAD_LEFT);
    pos_remember_voucher_category($posStoreId, $type, trim((string)($body['category']??'')));
    db()->prepare('INSERT INTO cash_vouchers (id,code,store_id,voucher_type,amount,category,note,person_name,include_in_cash_flow,happened_at,shift_id,cashier_id,cashier_name) VALUES (:id,:code,:store_id,:type,:amount,:category,:note,:person_name,:included,:happened_at,:shift_id,:cashier_id,:cashier_name)')->execute([
        'id'=>$id,'code'=>$code,'store_id'=>trim((string)($body['storeId']??'cafe')),'type'=>$type,'amount'=>(float)($body['amount']??0),
        'category'=>trim((string)($body['category']??'')),'note'=>trim((string)($body['note']??'')),
        'person_name'=>trim((string)($body['personName']??'')),'included'=>pos_bool($body['includeInCashFlow']??true,true)?1:0,
        'happened_at'=>pos_mysql_datetime($body['happenedAt']??'now'),'shift_id'=>trim((string)($body['shiftId']??''))?:null,
        'cashier_id'=>trim((string)($body['cashierId']??''))?:null,'cashier_name'=>trim((string)($body['cashierName']??''))?:null,
    ]); respond_ok(['id'=>$id],201);
}

if ($method === 'PATCH' && $resource === 'vouchers') {
    pos_assert_record_store('cash_vouchers', trim((string)($body['id']??'')), $user, $posStoreId);
    db()->prepare('UPDATE cash_vouchers SET category=:category,amount=:amount WHERE id=:id')->execute(['id'=>trim((string)($body['id']??'')),'category'=>trim((string)($body['category']??'')),'amount'=>(float)($body['amount']??0)]);
    $voucherTypeStatement = db()->prepare('SELECT voucher_type FROM cash_vouchers WHERE id=:id AND store_id=:store_id');
    $voucherTypeStatement->execute(['id'=>trim((string)($body['id']??'')),'store_id'=>$posStoreId]);
    $voucherType = $voucherTypeStatement->fetchColumn();
    if ($voucherType !== false) pos_remember_voucher_category($posStoreId, (string)$voucherType, trim((string)($body['category']??'')));
    respond_ok(['updated'=>true]);
}

if ($method === 'GET' && $resource === 'shifts') {
    $statement=db()->prepare("SELECT * FROM cashier_shifts WHERE store_id=:store_id AND cashier_uid=:cashier_uid AND status='open' ORDER BY opened_at DESC LIMIT 1");
    $statement->execute(['store_id'=>trim((string)($_GET['storeId']??'')),'cashier_uid'=>trim((string)($_GET['cashierUid']??''))]); $row=$statement->fetch();
    if(!$row) respond_ok(['item'=>null]);
    respond_ok(['item'=>pos_shift_payload($row)]);
}

if ($method === 'POST' && $resource === 'shifts') {
    $storeId = $posStoreId;
    $cashierUid = ($user['role'] ?? '') === 'user'
        ? (string) $user['id']
        : trim((string) ($body['cashierUid'] ?? ''));
    $cashierName = trim((string) ($body['cashierName'] ?? ($user['displayName'] ?? 'Thu ngân')));
    $deviceId = substr(trim((string) ($body['deviceId'] ?? '')), 0, 100);
    $deviceName = substr(trim((string) ($body['deviceName'] ?? '')), 0, 255);
    if ($cashierUid === '' || $deviceId === '') {
        respond_error('Thiếu thông tin tài khoản hoặc thiết bị mở ca', 422);
    }
    if (!array_key_exists('openingCash', $body) || !is_numeric($body['openingCash']) || (float) $body['openingCash'] <= 0) {
        respond_error('Tiền mặt đầu ca phải lớn hơn 0', 422);
    }
    $openingCash = (float) $body['openingCash'];

    $lockName = 'pos_shift_' . substr(hash('sha256', $storeId . '|' . $cashierUid), 0, 48);
    $lockStatement = db()->prepare('SELECT GET_LOCK(:lock_name, 5)');
    $lockStatement->execute(['lock_name' => $lockName]);
    if ((int) $lockStatement->fetchColumn() !== 1) {
        respond_error('Không thể khóa thao tác mở ca, vui lòng thử lại', 503);
    }

    $alreadyOpen = false;
    $shiftRow = null;
    try {
        $find = db()->prepare(
            "SELECT * FROM cashier_shifts
             WHERE store_id=:store_id AND cashier_uid=:cashier_uid AND status='open'
             ORDER BY opened_at DESC LIMIT 1"
        );
        $find->execute(['store_id' => $storeId, 'cashier_uid' => $cashierUid]);
        $shiftRow = $find->fetch();

        if ($shiftRow) {
            $alreadyOpen = true;
        } else {
            $id = uuidv4();
            db()->prepare(
                'INSERT INTO cashier_shifts (
                    id,store_id,cashier_uid,cashier_name,shift_type,status,
                    opening_cash,open_note,opened_by_device_id,opened_by_device_name
                 ) VALUES (
                    :id,:store_id,:cashier_uid,:cashier_name,:shift_type,\'open\',
                    :opening_cash,:open_note,:device_id,:device_name
                 )'
            )->execute([
                'id' => $id,
                'store_id' => $storeId,
                'cashier_uid' => $cashierUid,
                'cashier_name' => $cashierName,
                'shift_type' => in_array($body['shiftType'] ?? 'single', ['shift_1','shift_2','shift_3','single'], true) ? $body['shiftType'] : 'single',
                'opening_cash' => $openingCash,
                'open_note' => trim((string) ($body['openNote'] ?? '')),
                'device_id' => $deviceId,
                'device_name' => $deviceName !== '' ? $deviceName : 'Thiết bị POS',
            ]);
            $find->execute(['store_id' => $storeId, 'cashier_uid' => $cashierUid]);
            $shiftRow = $find->fetch();
        }
    } finally {
        $release = db()->prepare('SELECT RELEASE_LOCK(:lock_name)');
        $release->execute(['lock_name' => $lockName]);
    }

    if (!$shiftRow) {
        respond_error('Không thể tải ca vừa mở', 500);
    }
    realtime_publish($posStoreId, 'shifts-updated', ['id' => (string) $shiftRow['id'], 'action' => $alreadyOpen ? 'synced' : 'opened']);
    respond_ok(
        ['item' => pos_shift_payload($shiftRow), 'alreadyOpen' => $alreadyOpen],
        $alreadyOpen ? 200 : 201
    );
}

if ($method === 'PATCH' && $resource === 'shifts') {
    pos_assert_record_store('cashier_shifts', trim((string)($body['id']??'')), $user, $posStoreId);
    $summary=is_array($body['summary']??null)?$body['summary']:[];
    db()->prepare("UPDATE cashier_shifts SET status='closed',closed_at=NOW(),closing_cash=:closing_cash,close_note=:close_note,expected_closing_cash=:expected,cash_sales=:cash_sales,transfer_sales=:transfer_sales,total_sales=:total_sales,completed_bills=:completed,cancelled_bills=:cancelled,cancelled_amount=:cancelled_amount,income_vouchers=:income,expense_vouchers=:expense,net_cash_flow=:net WHERE id=:id")->execute([
        'id'=>trim((string)($body['id']??'')),'closing_cash'=>(float)($body['closingCash']??0),'close_note'=>trim((string)($body['closeNote']??'')),
        'expected'=>(float)($summary['expectedClosingCash']??0),'cash_sales'=>(float)($summary['cashSales']??0),'transfer_sales'=>(float)($summary['transferSales']??0),
        'total_sales'=>(float)($summary['totalSales']??0),'completed'=>(int)($summary['completedBills']??0),'cancelled'=>(int)($summary['cancelledBills']??0),
        'cancelled_amount'=>(float)($summary['cancelledAmount']??0),'income'=>(float)($summary['incomeVouchers']??0),'expense'=>(float)($summary['expenseVouchers']??0),'net'=>(float)($summary['netCashFlow']??0),
    ]); realtime_publish($posStoreId,'shifts-updated',['id'=>trim((string)($body['id']??'')),'action'=>'closed']);respond_ok(['updated'=>true]);
}

if ($method === 'GET' && $resource === 'live-orders') {
    $statement=db()->prepare("SELECT * FROM live_orders WHERE store_id=:store_id AND status='open' ORDER BY updated_at DESC"); $statement->execute(['store_id'=>trim((string)($_GET['storeId']??''))]); $rows=$statement->fetchAll();
    $ids=array_map(static fn(array $row):string=>(string)$row['id'],$rows); $items=[];
    if($ids!==[]){$p=implode(',',array_fill(0,count($ids),'?'));$s=db()->prepare("SELECT * FROM live_order_items WHERE live_order_id IN ($p) ORDER BY id");$s->execute($ids);foreach($s->fetchAll() as $item)$items[(string)$item['live_order_id']][]=['menuId'=>(string)$item['menu_id'],'name'=>(string)$item['name'],'price'=>(float)$item['price'],'quantity'=>(float)$item['quantity'],'note'=>$item['note']?:'','category'=>$item['category']?:''];}
    pos_polling_response(array_map(static fn(array $row):array=>['id'=>(string)$row['id'],'storeId'=>(string)$row['store_id'],'orderKey'=>(string)$row['order_key'],'tableNumber'=>(string)$row['order_key'],'status'=>(string)$row['status'],'items'=>$items[(string)$row['id']]??[],'createdAt'=>pos_timestamp($row['created_at']),'updatedAt'=>pos_timestamp($row['updated_at'])],$rows));
}

if ($method === 'PUT' && $resource === 'live-orders') {
    $storeId=trim((string)($body['storeId']??''));$orderKey=trim((string)($body['orderKey']??''));$id=$storeId.'__'.hash('sha256',strtolower($orderKey));$items=is_array($body['items']??null)?$body['items']:[];
    db()->beginTransaction();try{db()->prepare("INSERT INTO live_orders (id,store_id,order_key,status) VALUES (:id,:store_id,:order_key,'open') ON DUPLICATE KEY UPDATE order_key=VALUES(order_key),status='open',updated_at=NOW()")->execute(['id'=>$id,'store_id'=>$storeId,'order_key'=>$orderKey]);db()->prepare('DELETE FROM live_order_items WHERE live_order_id=:id')->execute(['id'=>$id]);$s=db()->prepare('INSERT INTO live_order_items (live_order_id,menu_id,name,price,quantity,note,category) VALUES (:id,:menu_id,:name,:price,:quantity,:note,:category)');foreach($items as $item)$s->execute(['id'=>$id,'menu_id'=>trim((string)($item['menuId']??'')),'name'=>trim((string)($item['name']??'')),'price'=>(float)($item['price']??0),'quantity'=>(float)($item['quantity']??0),'note'=>trim((string)($item['note']??'')),'category'=>trim((string)($item['category']??''))]);db()->commit();}catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}realtime_publish($storeId,'live-orders-updated',['id'=>$id,'orderKey'=>$orderKey,'action'=>'updated']);respond_ok(['id'=>$id]);
}

if ($method === 'DELETE' && $resource === 'live-orders') {
    $storeId=trim((string)($_GET['storeId']??''));$orderKey=trim((string)($_GET['orderKey']??''));db()->prepare('DELETE FROM live_orders WHERE store_id=:store_id AND order_key=:order_key')->execute(['store_id'=>$storeId,'order_key'=>$orderKey]);realtime_publish($storeId,'live-orders-updated',['orderKey'=>$orderKey,'action'=>'deleted']);respond_ok(['deleted'=>true]);
}

if (in_array($resource, ['kitchen-jobs','bar-jobs'], true)) {
    $prefix=$resource==='kitchen-jobs'?'kitchen':'bar';$jobTable=$prefix.'_print_jobs';$itemTable=$prefix.'_print_job_items';
    if($prefix==='bar') pos_ensure_bar_workflow_columns();
    if($method==='GET'){
        $isBoard=$prefix==='bar'&&trim((string)($_GET['view']??''))==='board';
        $where=$isBoard?"workflow_status<>'collected'":"status='pending'";
        $statement=db()->prepare("SELECT * FROM {$jobTable} WHERE store_id=:store_id AND {$where} ORDER BY created_at");$statement->execute(['store_id'=>trim((string)($_GET['storeId']??''))]);$rows=$statement->fetchAll();$ids=array_map(static fn(array $r):string=>(string)$r['id'],$rows);$items=pos_job_items($itemTable,$ids);pos_polling_response(array_map(static fn(array $row):array=>['id'=>(string)$row['id'],'storeId'=>(string)$row['store_id'],'orderKey'=>(string)$row['table_number'],'tableNumber'=>(string)$row['table_number'],'sourceBillId'=>$row['bill_id']?:'','items'=>$items[(string)$row['id']]??[],'status'=>(string)$row['status'],'workflowStatus'=>(string)($row['workflow_status']??'new'),'createdAt'=>pos_timestamp($row['created_at']),'workflowUpdatedAt'=>pos_timestamp($row['workflow_updated_at']??null),'collectedAt'=>pos_timestamp($row['collected_at']??null),'printedAt'=>pos_timestamp($row['printed_at']),'printedByTerminal'=>$row['terminal_name']?:''],$rows));
    }
    if($method==='POST'){$id=uuidv4();$items=is_array($body['items']??null)?$body['items']:[];db()->beginTransaction();try{db()->prepare("INSERT INTO {$jobTable} (id,store_id,bill_id,table_number,status,note) VALUES (:id,:store_id,:bill_id,:table_number,'pending',:note)")->execute(['id'=>$id,'store_id'=>trim((string)($body['storeId']??'')),'bill_id'=>trim((string)($body['sourceBillId']??''))?:null,'table_number'=>trim((string)($body['tableNumber']??'')),'note'=>trim((string)($body['orderKey']??''))]);$s=db()->prepare("INSERT INTO {$itemTable} (job_id,menu_id,name,quantity,note) VALUES (:job_id,:menu_id,:name,:quantity,:note)");foreach($items as $item)$s->execute(['job_id'=>$id,'menu_id'=>trim((string)($item['menuId']??'')),'name'=>trim((string)($item['name']??'')),'quantity'=>(float)($item['quantity']??0),'note'=>trim((string)($item['note']??''))]);db()->commit();}catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}realtime_publish($posStoreId,$prefix.'-jobs-updated',['id'=>$id,'action'=>'created']);respond_ok(['id'=>$id],201);}
    if($method==='PATCH'){
        $id=trim((string)($body['id']??''));pos_assert_record_store($jobTable,$id,$user,$posStoreId);
        if($prefix==='bar'&&array_key_exists('workflowStatus',$body)){
            $workflowStatus=trim((string)$body['workflowStatus']);
            if(!in_array($workflowStatus,['new','preparing','ready','collected'],true)) respond_error('Trạng thái pha chế không hợp lệ',422);
            db()->prepare("UPDATE bar_print_jobs SET workflow_status=:workflow_status,workflow_updated_at=NOW(),collected_at=IF(:is_collected=1,NOW(),NULL) WHERE id=:id")->execute(['id'=>$id,'workflow_status'=>$workflowStatus,'is_collected'=>$workflowStatus==='collected'?1:0]);
        }else{
            db()->prepare("UPDATE {$jobTable} SET status='printed',printed_at=NOW(),terminal_name=:terminal WHERE id=:id")->execute(['id'=>$id,'terminal'=>trim((string)($body['terminalName']??''))]);
        }
        realtime_publish($posStoreId,$prefix.'-jobs-updated',['id'=>$id,'action'=>'updated']);
        respond_ok(['updated'=>true]);
    }
}

respond_error('POS resource not found', 404);
