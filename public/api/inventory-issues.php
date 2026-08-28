<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/ingredients.php';

function inventory_issues_ensure_schema(): void
{
    ingredients_ensure_schema();
    db()->exec('CREATE TABLE IF NOT EXISTS inventory_issues (
        id VARCHAR(64) PRIMARY KEY, store_id VARCHAR(32) NOT NULL, issue_code VARCHAR(100) NOT NULL,
        issue_date DATE NOT NULL, destination VARCHAR(255) NOT NULL DEFAULT "Quầy pha chế", issued_by VARCHAR(255) NULL,
        status ENUM("draft","completed","cancelled") NOT NULL DEFAULT "draft", note TEXT NULL,
        total_quantity DECIMAL(15,3) NOT NULL DEFAULT 0, completed_at DATETIME NULL, completed_by VARCHAR(255) NULL,
        created_by VARCHAR(255) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_inventory_issues_code (store_id,issue_code), KEY idx_inventory_issues_store_date (store_id,issue_date),
        KEY idx_inventory_issues_store_status (store_id,status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    db()->exec('CREATE TABLE IF NOT EXISTS inventory_issue_items (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, issue_id VARCHAR(64) NOT NULL, ingredient_id VARCHAR(64) NOT NULL,
        ingredient_code VARCHAR(100) NOT NULL, ingredient_name VARCHAR(255) NOT NULL, unit VARCHAR(50) NULL,
        quantity DECIMAL(15,3) NOT NULL, stock_before DECIMAL(15,3) NULL, stock_after DECIMAL(15,3) NULL,
        note TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_inventory_issue_items_issue (issue_id), KEY idx_inventory_issue_items_ingredient (ingredient_id),
        CONSTRAINT fk_inventory_issue_items_issue FOREIGN KEY (issue_id) REFERENCES inventory_issues(id) ON DELETE CASCADE,
        CONSTRAINT fk_inventory_issue_items_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
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
        'createdAt' => (string) $row['created_at'], 'updatedAt' => (string) $row['updated_at'], 'items' => $items,
    ];
}

function inventory_issues_find(string $id, string $storeId): ?array
{
    $statement = db()->prepare('SELECT * FROM inventory_issues WHERE id=:id AND store_id=:store_id LIMIT 1');
    $statement->execute(['id' => $id, 'store_id' => $storeId]);
    $row = $statement->fetch();
    return $row ?: null;
}

inventory_issues_ensure_schema();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$user = auth_require_permission('inventory_issues.access');

if ($method === 'GET') {
    $storeId = field_inventory_require_store($user, trim((string) ($_GET['storeId'] ?? '')));
    $limit = max(1, min(100, (int) ($_GET['limit'] ?? 50)));
    $statement = db()->prepare("SELECT * FROM inventory_issues WHERE store_id=:store_id ORDER BY issue_date DESC,created_at DESC LIMIT $limit");
    $statement->execute(['store_id' => $storeId]);
    respond_ok(['items' => array_map('inventory_issues_payload', $statement->fetchAll())]);
}

$body = read_json_body();
$storeId = field_inventory_require_store($user, trim((string) ($body['storeId'] ?? '')));

if ($method === 'DELETE') {
    $id = trim((string) ($body['id'] ?? ''));
    $statement = db()->prepare('DELETE FROM inventory_issues WHERE id=:id AND store_id=:store_id AND status="draft"');
    $statement->execute(['id' => $id, 'store_id' => $storeId]);
    if ($statement->rowCount() === 0) respond_error('Chỉ có thể xóa phiếu xuất nháp.', 409);
    respond_ok(['deleted' => true]);
}

if ($method !== 'POST') respond_error('Method not allowed', 405);

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

$findIngredient = db()->prepare('SELECT * FROM ingredients WHERE store_id=:store_id AND ingredient_code=:code AND is_active=1 LIMIT 1');
$normalized = [];
foreach ($rawItems as $raw) {
    $code = trim((string) ($raw['ingredientCode'] ?? ''));
    $quantity = round((float) str_replace(',', '.', (string) ($raw['quantity'] ?? 0)), 3);
    if ($code === '' || $quantity <= 0) respond_error('Mỗi dòng phải có nguyên liệu và số lượng lớn hơn 0.', 422);
    if (isset($normalized[$code])) respond_error('Nguyên liệu ' . $code . ' bị lặp trong phiếu.', 422);
    $findIngredient->execute(['store_id' => $storeId, 'code' => $code]);
    $ingredient = $findIngredient->fetch();
    $findIngredient->closeCursor();
    if (!$ingredient) respond_error('Không tìm thấy nguyên liệu ' . $code . '.', 422);
    $normalized[$code] = ['ingredient' => $ingredient, 'quantity' => $quantity, 'note' => trim((string) ($raw['note'] ?? ''))];
}

$pdo = db();
$pdo->beginTransaction();
try {
    $existing = $id !== '' ? inventory_issues_find($id, $storeId) : null;
    if ($id !== '' && !$existing) throw new RuntimeException('Không tìm thấy phiếu xuất.');
    if ($existing && $existing['status'] !== 'draft') throw new RuntimeException('Phiếu đã hoàn thành không thể chỉnh sửa.');
    if ($id === '') {
        $id = uuidv4();
        $insert = $pdo->prepare('INSERT INTO inventory_issues (id,store_id,issue_code,issue_date,destination,issued_by,status,note,total_quantity,created_by) VALUES (:id,:store_id,:code,:date,:destination,:issued_by,"draft",:note,:total,:actor)');
        $insert->execute(['id' => $id, 'store_id' => $storeId, 'code' => inventory_issues_code($storeId), 'date' => $issueDate, 'destination' => $destination, 'issued_by' => $issuedBy, 'note' => trim((string) ($body['note'] ?? '')), 'total' => array_sum(array_column($normalized, 'quantity')), 'actor' => inventory_issues_actor($user)]);
    } else {
        $pdo->prepare('UPDATE inventory_issues SET issue_date=:date,destination=:destination,issued_by=:issued_by,note=:note,total_quantity=:total,updated_at=NOW() WHERE id=:id')->execute(['id' => $id, 'date' => $issueDate, 'destination' => $destination, 'issued_by' => $issuedBy, 'note' => trim((string) ($body['note'] ?? '')), 'total' => array_sum(array_column($normalized, 'quantity'))]);
        $pdo->prepare('DELETE FROM inventory_issue_items WHERE issue_id=:id')->execute(['id' => $id]);
    }
    $insertItem = $pdo->prepare('INSERT INTO inventory_issue_items (issue_id,ingredient_id,ingredient_code,ingredient_name,unit,quantity,note) VALUES (:issue,:ingredient,:code,:name,:unit,:quantity,:note)');
    foreach ($normalized as $line) {
        $ingredient = $line['ingredient'];
        $insertItem->execute(['issue' => $id, 'ingredient' => $ingredient['id'], 'code' => $ingredient['ingredient_code'], 'name' => $ingredient['ingredient_name'], 'unit' => $ingredient['unit'], 'quantity' => $line['quantity'], 'note' => $line['note']]);
    }
    if ($status === 'completed') {
        $lock = $pdo->prepare('SELECT stock_quantity FROM ingredients WHERE id=:id FOR UPDATE');
        $deduct = $pdo->prepare('UPDATE ingredients SET stock_quantity=:stock,updated_at=NOW() WHERE id=:id');
        $snapshot = $pdo->prepare('UPDATE inventory_issue_items SET stock_before=:before,stock_after=:after WHERE issue_id=:issue AND ingredient_id=:ingredient');
        foreach ($normalized as $line) {
            $ingredient = $line['ingredient'];
            $lock->execute(['id' => $ingredient['id']]);
            $before = (float) $lock->fetchColumn();
            $lock->closeCursor();
            $after = round($before - $line['quantity'], 3);
            if ($after < 0) throw new RuntimeException('Tồn kho ' . $ingredient['ingredient_code'] . ' chỉ còn ' . $before . ' ' . ($ingredient['unit'] ?? '') . '.');
            $deduct->execute(['id' => $ingredient['id'], 'stock' => $after]);
            $snapshot->execute(['issue' => $id, 'ingredient' => $ingredient['id'], 'before' => $before, 'after' => $after]);
        }
        $pdo->prepare('UPDATE inventory_issues SET status="completed",completed_at=NOW(),completed_by=:actor,updated_at=NOW() WHERE id=:id')->execute(['id' => $id, 'actor' => inventory_issues_actor($user)]);
    }
    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    respond_error($exception->getMessage(), 422);
}

$saved = inventory_issues_find($id, $storeId);
respond_ok(['item' => inventory_issues_payload($saved)], $existing ? 200 : 201);
