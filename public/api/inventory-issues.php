<?php

declare(strict_types=1);
require_once __DIR__ . '/_lib/search.php';

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/ingredients.php';
require_once __DIR__ . '/_lib/inventory_issue_print_jobs.php';
require_once __DIR__ . '/_lib/inventory_issue_quantities.php';
require_once __DIR__ . '/_lib/inventory_issue_corrections.php';
require_once __DIR__ . '/_lib/preparation_receipt_cancellations.php';

function inventory_issues_ensure_schema(): void
{
    ingredients_ensure_schema();
    $hasPreparationTable = db()->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='preparation_receipts'")->fetchColumn();
    if ((int)$hasPreparationTable) preparation_receipts_ensure_cancel_column('status', 'VARCHAR(20) NOT NULL DEFAULT "completed"');
    db()->exec('CREATE TABLE IF NOT EXISTS inventory_issues (
        id VARCHAR(64) PRIMARY KEY, store_id VARCHAR(32) NOT NULL, issue_code VARCHAR(100) NOT NULL,
        issue_date DATE NOT NULL, destination VARCHAR(255) NOT NULL DEFAULT "Nơi sử dụng", issued_by VARCHAR(255) NULL,
        status ENUM("draft","completed","cancelled") NOT NULL DEFAULT "draft", note TEXT NULL,
        total_quantity DECIMAL(18,6) NOT NULL DEFAULT 0, completed_at DATETIME NULL, completed_by VARCHAR(255) NULL,
        created_by VARCHAR(255) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_inventory_issues_code (store_id,issue_code), KEY idx_inventory_issues_store_date (store_id,issue_date),
        KEY idx_inventory_issues_store_status (store_id,status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    db()->exec('CREATE TABLE IF NOT EXISTS inventory_issue_items (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, issue_id VARCHAR(64) NOT NULL, ingredient_id VARCHAR(64) NOT NULL,
        ingredient_code VARCHAR(100) NOT NULL, ingredient_name VARCHAR(255) NOT NULL, unit VARCHAR(50) NULL,
        quantity DECIMAL(18,6) NOT NULL, stock_before DECIMAL(15,3) NULL, stock_after DECIMAL(15,3) NULL,
        note TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_inventory_issue_items_issue (issue_id), KEY idx_inventory_issue_items_ingredient (ingredient_id),
        CONSTRAINT fk_inventory_issue_items_issue FOREIGN KEY (issue_id) REFERENCES inventory_issues(id) ON DELETE CASCADE,
        CONSTRAINT fk_inventory_issue_items_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    auth_ensure_column('inventory_issue_items', 'base_quantity', 'DECIMAL(15,3) NULL AFTER quantity');
    auth_ensure_column('inventory_issues', 'shift_id', 'VARCHAR(64) NULL AFTER created_by');
    auth_ensure_column('inventory_issues', 'shift_type', 'VARCHAR(20) NULL AFTER shift_id');
    auth_ensure_column('inventory_issues', 'requires_preparation_receipt', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER shift_type');
    auth_ensure_column('inventory_issues', 'revision', 'INT UNSIGNED NOT NULL DEFAULT 0');
    auth_ensure_column('inventory_issues', 'cancel_reason', 'TEXT NULL');
    auth_ensure_column('inventory_issues', 'cancelled_by', 'VARCHAR(255) NULL');
    auth_ensure_column('inventory_issues', 'cancelled_at', 'DATETIME NULL');
    inventory_issue_ensure_quantity_precision(db());
}

function inventory_issues_actor(array $user): string
{
    return trim((string) ($user['displayName'] ?? $user['display_name'] ?? $user['username'] ?? $user['email'] ?? $user['id'] ?? ''));
}

function inventory_issues_code(string $storeId): string
{
    $prefix = 'XK-' . date('Ym') . '-';
    $statement = db()->prepare('SELECT issue_code FROM inventory_issues WHERE store_id=:store_id AND issue_code LIKE :prefix ORDER BY issue_code DESC LIMIT 1');
    $statement->execute(['store_id' => $storeId, 'prefix' => $prefix . '%']);
    $last = (string) ($statement->fetchColumn() ?: '');
    return $prefix . str_pad((string) ((int) substr($last, -4) + 1), 4, '0', STR_PAD_LEFT);
}

function inventory_issues_items(string $id): array
{
    $statement = db()->prepare('SELECT * FROM inventory_issue_items WHERE issue_id=:id ORDER BY id');
    $statement->execute(['id' => $id]);
    return array_map(static fn(array $row): array => [
        'id' => (int) $row['id'], 'ingredientId' => (string) $row['ingredient_id'],
        'ingredientCode' => (string) $row['ingredient_code'], 'ingredientName' => (string) $row['ingredient_name'],
        'unit' => (string) ($row['unit'] ?? ''), 'quantity' => (float) $row['quantity'],
        'baseQuantity' => $row['base_quantity'] !== null ? (float) $row['base_quantity'] : (float) $row['quantity'],
        'stockBefore' => $row['stock_before'] !== null ? (float) $row['stock_before'] : null,
        'stockAfter' => $row['stock_after'] !== null ? (float) $row['stock_after'] : null,
        'note' => (string) ($row['note'] ?? ''),
    ], $statement->fetchAll());
}

function inventory_issues_payload(array $row): array
{
    $items = inventory_issues_items((string) $row['id']);
    return [
        'id' => (string) $row['id'], 'storeId' => (string) $row['store_id'], 'issueCode' => (string) $row['issue_code'],
        'issueDate' => (string) $row['issue_date'], 'destination' => (string) $row['destination'],
        'issuedBy' => (string) ($row['issued_by'] ?? ''), 'status' => (string) $row['status'],
        'note' => (string) ($row['note'] ?? ''), 'totalQuantity' => (float) $row['total_quantity'],
        'itemCount' => count($items), 'completedAt' => $row['completed_at'] ?: null,
        'completedBy' => $row['completed_by'] ?: null, 'createdBy' => (string) ($row['created_by'] ?? ''),
        'shiftId' => $row['shift_id'] ?: null, 'shiftType' => $row['shift_type'] ?: null,
        'createdAt' => (string) $row['created_at'], 'updatedAt' => (string) $row['updated_at'], 'items' => $items,
        'printJob' => inventory_issue_print_jobs_latest((string) $row['id']),
        'revision' => (int) $row['revision'], 'cancelReason' => (string) ($row['cancel_reason'] ?? ''),
        'cancelledBy' => $row['cancelled_by'] ?: null, 'cancelledAt' => $row['cancelled_at'] ?: null,
    ];
}

function inventory_issues_find(string $id, string $storeId, bool $lock = false): ?array
{
    $statement = db()->prepare('SELECT * FROM inventory_issues WHERE id=:id AND store_id=:store_id LIMIT 1' . ($lock ? ' FOR UPDATE' : ''));
    $statement->execute(['id' => $id, 'store_id' => $storeId]);
    $row = $statement->fetch();
    return $row ?: null;
}

inventory_issues_ensure_schema();
inventory_issue_print_jobs_ensure_schema();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$user = auth_require_permission('inventory_issues.access');

if ($method === 'GET') {
    $storeId = field_inventory_require_store($user, trim((string) ($_GET['storeId'] ?? '')));
    $limit = max(1, min(100, (int) ($_GET['limit'] ?? 50)));
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $where = ['store_id=:store_id']; $params = ['store_id' => $storeId];
    foreach (['dateFrom' => '>=', 'dateTo' => '<='] as $key => $operator) {
        $value = trim((string) ($_GET[$key] ?? ''));
        if ($value === '') continue;
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value) respond_error('Ngày lọc không hợp lệ.', 422);
        $where[] = "issue_date $operator :$key"; $params[$key] = $value;
    }
    if (isset($params['dateFrom'], $params['dateTo']) && $params['dateFrom'] > $params['dateTo']) respond_error('Khoảng ngày không hợp lệ.', 422);
    $keyword = trim((string) ($_GET['keyword'] ?? ''));
    if ($keyword !== '') {
        $where[] = '(' . admin_search_expression('issue_code') . ' LIKE :code OR ' . admin_search_expression('destination') . ' LIKE :destination OR ' . admin_search_expression('issued_by') . ' LIKE :issued_by)';
        foreach (['code', 'destination', 'issued_by'] as $key) $params[$key] = admin_search_value($keyword);
    }
    $filter = implode(' AND ', $where);
    $count = db()->prepare("SELECT COUNT(*) FROM inventory_issues WHERE $filter");
    $count->execute($params); $total = (int) $count->fetchColumn();
    $pages = max(1, (int) ceil($total / $limit)); $page = min($page, $pages);
    $offset = ($page - 1) * $limit;
    $statement = db()->prepare("SELECT * FROM inventory_issues WHERE $filter ORDER BY issue_date DESC,created_at DESC,id DESC LIMIT $limit OFFSET $offset");
    $statement->execute($params);
    respond_ok(['items' => array_map('inventory_issues_payload', $statement->fetchAll()), 'pagination' => ['page' => $page, 'limit' => $limit, 'total' => $total, 'pages' => $pages]]);

}

$body = read_json_body();
$storeId = field_inventory_require_store($user, trim((string) ($body['storeId'] ?? '')));

// Physical deletion is intentionally unavailable, including for drafts.
if ($method === 'DELETE') respond_error('Không được xóa phiếu xuất. Vui lòng hủy phiếu và nhập lý do.', 405);
if ($method !== 'POST') respond_error('Method not allowed', 405);

function inventory_issues_has_preparation_receipt(PDO $pdo, string $id): bool
{
    $exists = $pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='preparation_receipts'")->fetchColumn();
    if (!(int) $exists) return false;
    $statement = $pdo->prepare('SELECT id FROM preparation_receipts WHERE issue_id=:id AND status="completed" LIMIT 1');
    $statement->execute(['id'=>$id]);
    return (bool) $statement->fetchColumn();
}

function inventory_issues_lock_print_jobs(PDO $pdo, string $id): void
{
    $statement = $pdo->prepare('SELECT status FROM inventory_issue_print_jobs WHERE issue_id=:id FOR UPDATE');
    $statement->execute(['id'=>$id]);
    foreach ($statement->fetchAll() as $job) {
        if ($job['status'] === 'processing') throw new RuntimeException('Phiếu đang được máy in xử lý. Vui lòng đợi in xong rồi thử lại.');
    }
}

if (($body['action'] ?? '') === 'cancel') {
    if ($user['role'] !== 'admin') respond_error('Chỉ admin được hủy phiếu xuất.', 403);
    $id = trim((string) ($body['id'] ?? ''));
    $reason = trim((string) ($body['reason'] ?? ''));
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $existing = inventory_issues_find($id, $storeId, true);
        if (!$existing) throw new RuntimeException('Không tìm thấy phiếu xuất.');
        inventory_issue_validate_correction($user['role'], $existing, isset($body['revision']) ? (int) $body['revision'] : null, 'cancel', $reason);
        if (inventory_issues_has_preparation_receipt($pdo, $id)) throw new RuntimeException('Phiếu đã được quầy pha chế nhận. Cần xử lý phiếu nhận liên quan trước khi hủy để không sai tồn kho.');
        inventory_issues_lock_print_jobs($pdo, $id);
        if ($existing['status'] === 'completed') inventory_issue_apply_corrected_stock($pdo, $storeId, inventory_issues_items($id), []);
        $pdo->prepare('UPDATE inventory_issues SET status="cancelled",cancel_reason=:reason,cancelled_by=:actor,cancelled_at=NOW(),requires_preparation_receipt=0,revision=revision+1,updated_at=NOW() WHERE id=:id')
            ->execute(['id'=>$id,'reason'=>$reason,'actor'=>inventory_issues_actor($user)]);
        $pdo->prepare('UPDATE inventory_issue_print_jobs SET status="cancelled",next_attempt_at=NULL,updated_at=NOW() WHERE issue_id=:id AND status IN ("pending","failed")')->execute(['id'=>$id]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        respond_error($exception->getMessage(), 409);
    }
    respond_ok(['item'=>inventory_issues_payload(inventory_issues_find($id, $storeId))]);
}
if (isset($body['action'])) respond_error('Thao tác không hợp lệ.', 422);

$id = trim((string) ($body['id'] ?? ''));
$status = strtolower(trim((string) ($body['status'] ?? 'draft')));
if (!in_array($status, ['draft', 'completed'], true)) respond_error('Trạng thái phiếu xuất không hợp lệ.', 422);
$issueDate = trim((string) ($body['issueDate'] ?? ''));
$date = DateTimeImmutable::createFromFormat('!Y-m-d', $issueDate);
if (!$date || $date->format('Y-m-d') !== $issueDate) respond_error('Ngày xuất kho không hợp lệ.', 422);
$destination = trim((string) ($body['destination'] ?? ''));
$issuedBy = trim((string) ($body['issuedBy'] ?? ''));
if ($destination === '' || $issuedBy === '') respond_error('Vui lòng nhập nơi nhận và người xuất.', 422);
$rawItems = is_array($body['items'] ?? null) ? $body['items'] : [];
if ($rawItems === []) respond_error('Phiếu xuất phải có ít nhất một nguyên liệu.', 422);

$findIngredient = db()->prepare('SELECT * FROM ingredients WHERE store_id=:store_id AND ingredient_code=:code LIMIT 1');
$normalized = [];
foreach ($rawItems as $raw) {
    $code = trim((string) ($raw['ingredientCode'] ?? ''));
    $quantity = inventory_issue_parse_quantity($raw['quantity'] ?? 0);
    if ($code === '' || $quantity <= 0) respond_error('Mỗi dòng phải có nguyên liệu và số lượng lớn hơn 0.', 422);
    if (isset($normalized[$code])) respond_error('Nguyên liệu ' . $code . ' bị lặp trong phiếu.', 422);
    $findIngredient->execute(['store_id' => $storeId, 'code' => $code]);
    $ingredient = $findIngredient->fetch();
    $findIngredient->closeCursor();
    if (!$ingredient) respond_error('Không tìm thấy nguyên liệu ' . $code . '.', 422);
    $conversionFactor = max(0.000001, (float) ($ingredient['purchase_to_base_factor'] ?? 1));
    $normalized[$code] = [
        'ingredient' => $ingredient,
        'quantity' => $quantity,
        'baseQuantity' => inventory_issue_base_quantity($quantity, $conversionFactor),
        'note' => trim((string) ($raw['note'] ?? '')),
    ];
}

$shiftId = trim((string) ($body['shiftId'] ?? '')) ?: null;
$shiftType = trim((string) ($body['shiftType'] ?? '')) ?: null;
if ($shiftId !== null && $id === '') {
    $shift = db()->prepare('SELECT shift_type FROM cashier_shifts WHERE id=:id AND store_id=:store_id AND status="open" LIMIT 1');
    $shift->execute(['id' => $shiftId, 'store_id' => $storeId]);
    $activeShiftType = $shift->fetchColumn();
    if ($activeShiftType === false) respond_error('Ca làm việc đã đóng hoặc không thuộc cửa hàng đang chọn.', 422);
    $shiftType = (string) $activeShiftType;
}

$pdo = db();
$pdo->beginTransaction();
try {
    $existing = $id !== '' ? inventory_issues_find($id, $storeId, true) : null;
    if ($id !== '' && !$existing) throw new RuntimeException('Không tìm thấy phiếu xuất.');
    $oldItems = [];
    $received = false;
    if ($existing) {
        inventory_issue_validate_correction($user['role'], $existing, isset($body['revision']) ? (int) $body['revision'] : null, 'edit', '');
        if ($existing['status'] === 'completed' && $status !== 'completed') throw new RuntimeException('Phiếu đã hoàn thành không thể chuyển về nháp.');
        $oldItems = inventory_issues_items($id);
        $received = inventory_issues_has_preparation_receipt($pdo, $id);
        if ($received) {
            $unchanged = count($oldItems) === count($normalized);
            foreach ($oldItems as $oldItem) {
                $newLine = $normalized[$oldItem['ingredientCode']] ?? null;
                if (!$newLine || abs($newLine['quantity'] - $oldItem['quantity']) > 0.0000001 || abs($newLine['baseQuantity'] - $oldItem['baseQuantity']) > 0.0000001) $unchanged = false;
            }
            if (!$unchanged) throw new RuntimeException('Phiếu đã được quầy pha chế nhận. Cần xử lý phiếu nhận liên quan trước khi đổi nguyên liệu hoặc số lượng.');
        }
        inventory_issues_lock_print_jobs($pdo, $id);
    }
    $originalIngredientIds = array_column($oldItems, 'ingredientId');
    foreach ($normalized as $line) {
        if (!(int) $line['ingredient']['is_active'] && !in_array($line['ingredient']['id'], $originalIngredientIds, true)) {
            throw new RuntimeException('Không thể thêm nguyên liệu đã ngừng sử dụng vào phiếu xuất.');
        }
    }
    if ($id === '') {
        $id = uuidv4();
        $insert = $pdo->prepare('INSERT INTO inventory_issues (id,store_id,issue_code,issue_date,destination,issued_by,status,note,total_quantity,created_by,shift_id,shift_type) VALUES (:id,:store_id,:code,:date,:destination,:issued_by,"draft",:note,:total,:actor,:shift_id,:shift_type)');
        $insert->execute(['id' => $id, 'store_id' => $storeId, 'code' => inventory_issues_code($storeId), 'date' => $issueDate, 'destination' => $destination, 'issued_by' => $issuedBy, 'note' => trim((string) ($body['note'] ?? '')), 'total' => array_sum(array_column($normalized, 'quantity')), 'actor' => inventory_issues_actor($user), 'shift_id' => $shiftId, 'shift_type' => $shiftType]);
    } else {
        $pdo->prepare('UPDATE inventory_issues SET issue_date=:date,destination=:destination,issued_by=:issued_by,note=:note,total_quantity=:total,revision=revision+1,updated_at=NOW() WHERE id=:id')->execute(['id' => $id, 'date' => $issueDate, 'destination' => $destination, 'issued_by' => $issuedBy, 'note' => trim((string) ($body['note'] ?? '')), 'total' => array_sum(array_column($normalized, 'quantity'))]);
        $pdo->prepare('DELETE FROM inventory_issue_items WHERE issue_id=:id')->execute(['id' => $id]);
    }
    $insertItem = $pdo->prepare('INSERT INTO inventory_issue_items (issue_id,ingredient_id,ingredient_code,ingredient_name,unit,quantity,base_quantity,note) VALUES (:issue,:ingredient,:code,:name,:unit,:quantity,:base_quantity,:note)');
    foreach ($normalized as $line) {
        $ingredient = $line['ingredient'];
        $insertItem->execute(['issue' => $id, 'ingredient' => $ingredient['id'], 'code' => $ingredient['ingredient_code'], 'name' => $ingredient['ingredient_name'], 'unit' => $ingredient['purchase_unit'] ?: $ingredient['unit'], 'quantity' => $line['quantity'], 'base_quantity' => $line['baseQuantity'], 'note' => $line['note']]);
    }
    if ($status === 'completed') {
        $snapshots = $received ? [] : inventory_issue_apply_corrected_stock($pdo, $storeId, $existing && $existing['status'] === 'completed' ? $oldItems : [], array_values($normalized));
        if ($received) {
            foreach ($oldItems as $item) $snapshots[$item['ingredientId']] = ['before'=>$item['stockBefore'], 'after'=>$item['stockAfter'], 'baseQuantity'=>$item['baseQuantity']];
        }
        $snapshot = $pdo->prepare('UPDATE inventory_issue_items SET stock_before=:before,stock_after=:after,base_quantity=:base WHERE issue_id=:issue AND ingredient_id=:ingredient');
        foreach ($snapshots as $ingredientId => $values) {
            $snapshot->execute(['issue'=>$id,'ingredient'=>$ingredientId,'before'=>$values['before'],'after'=>$values['after'],'base'=>$values['baseQuantity']]);
        }
        $hasStockedItems = count(array_filter($normalized, static fn(array $line): bool => ($line['ingredient']['item_kind'] ?? 'ingredient') !== 'fresh')) > 0;
        $pdo->prepare('UPDATE inventory_issues SET status="completed",requires_preparation_receipt=:requires_receipt,completed_at=COALESCE(completed_at,NOW()),completed_by=COALESCE(completed_by,:actor),updated_at=NOW() WHERE id=:id')->execute(['id' => $id, 'requires_receipt' => $received || $storeId === 'warehouse' || !$hasStockedItems ? 0 : 1, 'actor' => inventory_issues_actor($user)]);
        if (!$existing || $existing['status'] === 'draft') inventory_issue_print_jobs_create_initial($pdo, $id, $storeId);
    }
    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    respond_error($exception->getMessage(), 422);
}

$saved = inventory_issues_find($id, $storeId);
respond_ok(['item' => inventory_issues_payload($saved)], $existing ? 200 : 201);
