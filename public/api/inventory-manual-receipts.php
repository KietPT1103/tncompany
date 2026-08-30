<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/products_inventory.php';
require_once __DIR__ . '/_lib/ingredients.php';

products_inventory_ensure_schema();
ingredients_ensure_schema();
auth_ensure_column('inventory_receipts', 'entry_source', "ENUM('mobile_photo','web_manual') NOT NULL DEFAULT 'mobile_photo' AFTER receipt_date");
auth_ensure_column('inventory_receipts', 'order_creator_name', 'VARCHAR(255) NULL AFTER supplier_id');
auth_ensure_column('inventory_receipts', 'total_quantity', 'DECIMAL(15,3) NOT NULL DEFAULT 0 AFTER note');
auth_ensure_column('inventory_receipts', 'completed_by_user_id', 'VARCHAR(64) NULL AFTER completed_by');

db()->exec('CREATE TABLE IF NOT EXISTS inventory_stock_movements (
    id VARCHAR(64) PRIMARY KEY, receipt_id VARCHAR(64) NOT NULL, receipt_item_id BIGINT UNSIGNED NOT NULL,
    store_id VARCHAR(32) NOT NULL, product_id VARCHAR(64) NULL, ingredient_id VARCHAR(64) NULL,
    quantity DECIMAL(15,3) NOT NULL, stock_before DECIMAL(15,3) NOT NULL, stock_after DECIMAL(15,3) NOT NULL,
    created_by VARCHAR(64) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_stock_movement_receipt_item (receipt_id,receipt_item_id),
    KEY idx_stock_movement_product (store_id,product_id), KEY idx_stock_movement_ingredient (store_id,ingredient_id),
    CONSTRAINT fk_stock_movement_receipt FOREIGN KEY (receipt_id) REFERENCES inventory_receipts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_stock_movement_item FOREIGN KEY (receipt_item_id) REFERENCES inventory_receipt_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respond_error('Method not allowed', 405);
}

$user = auth_require();
if (!field_inventory_has_permission($user, 'inventory_receipts.create')
    || !field_inventory_has_permission($user, 'inventory_receipts.complete')) {
    respond_error('Bạn không có quyền nhập và hoàn thành phiếu nhập kho.', 403);
}

$body = read_json_body();
$storeId = field_inventory_require_store($user, trim((string) ($body['storeId'] ?? '')));
$receiptDate = trim((string) ($body['receiptDate'] ?? ''));
$parsedDate = DateTimeImmutable::createFromFormat('!Y-m-d', $receiptDate);
if (!$parsedDate || $parsedDate->format('Y-m-d') !== $receiptDate) {
    respond_error('Ngày nhập kho không hợp lệ.', 422);
}

$enteredBy = trim((string) ($body['enteredBy'] ?? ''));
if ($enteredBy === '') {
    respond_error('Vui lòng nhập tên người nhập liệu.', 422);
}
if (mb_strlen($enteredBy) > 255) {
    respond_error('Tên người nhập liệu không được vượt quá 255 ký tự.', 422);
}

$supplierId = trim((string) ($body['supplierId'] ?? '')) ?: null;
if ($supplierId !== null) {
    $supplier = db()->prepare('SELECT id FROM suppliers WHERE id=:id AND store_id=:store_id AND is_active=1 LIMIT 1');
    $supplier->execute(['id' => $supplierId, 'store_id' => $storeId]);
    if (!$supplier->fetchColumn()) {
        respond_error('Nhà phân phối không tồn tại tại khu vực này.', 422);
    }
}

$rawItems = is_array($body['items'] ?? null) ? $body['items'] : [];
if ($rawItems === []) {
    respond_error('Phiếu nhập phải có ít nhất một nguyên liệu.', 422);
}

$findIngredient = db()->prepare(
    'SELECT id,ingredient_code,ingredient_name,unit,stock_quantity,cost
     FROM ingredients WHERE store_id=:store_id AND ingredient_code=:code AND is_active=1 LIMIT 1'
);
$items = [];
foreach ($rawItems as $raw) {
    $code = trim((string) ($raw['ingredientCode'] ?? ''));
    $quantity = round((float) str_replace(',', '.', (string) ($raw['quantity'] ?? 0)), 3);
    $unitCost = round((float) str_replace(',', '.', (string) ($raw['unitCost'] ?? 0)), 2);
    if ($code === '' || $quantity <= 0 || $unitCost < 0) {
        respond_error('Mỗi dòng phải có nguyên liệu, số lượng lớn hơn 0 và đơn giá không âm.', 422);
    }
    if (isset($items[$code])) {
        respond_error('Nguyên liệu ' . $code . ' bị lặp trong phiếu.', 422);
    }
    $findIngredient->execute(['store_id' => $storeId, 'code' => $code]);
    $ingredient = $findIngredient->fetch();
    $findIngredient->closeCursor();
    if (!$ingredient) {
        respond_error('Không tìm thấy nguyên liệu ' . $code . '.', 422);
    }
    $items[$code] = [
        'ingredient' => $ingredient,
        'quantity' => $quantity,
        'unitCost' => $unitCost,
        'lineTotal' => round($quantity * $unitCost, 2),
        'note' => trim((string) ($raw['note'] ?? '')),
    ];
}
ksort($items, SORT_NATURAL | SORT_FLAG_CASE);

$receiptId = uuidv4();
$actorId = (string) $user['id'];
$actorName = trim((string) ($user['displayName'] ?? $user['username'] ?? $user['email'] ?? $actorId));
$totalQuantity = round(array_sum(array_column($items, 'quantity')), 3);
$totalAmount = round(array_sum(array_column($items, 'lineTotal')), 2);
$pdo = db();
$pdo->beginTransaction();

try {
    $insertReceipt = $pdo->prepare(
        'INSERT INTO inventory_receipts (
            id,store_id,supplier_id,order_creator_name,receipt_code,receipt_date,entry_source,status,note,
            total_quantity,total_amount,completed_at,completed_by,completed_by_user_id,created_by
         ) VALUES (
            :id,:store_id,:supplier_id,:entered_by,:code,:receipt_date,"web_manual","completed",:note,
            :total_quantity,:total_amount,NOW(),:completed_by,:completed_actor_id,:created_actor_id
         )'
    );
    $insertReceipt->execute([
        'id' => $receiptId,
        'store_id' => $storeId,
        'supplier_id' => $supplierId,
        'entered_by' => $enteredBy,
        'code' => products_inventory_generate_receipt_code($storeId),
        'receipt_date' => $receiptDate,
        'note' => trim((string) ($body['note'] ?? '')) ?: null,
        'total_quantity' => $totalQuantity,
        'total_amount' => $totalAmount,
        'completed_by' => $actorName,
        'completed_actor_id' => $actorId,
        'created_actor_id' => $actorId,
    ]);

    $lockIngredient = $pdo->prepare('SELECT stock_quantity FROM ingredients WHERE id=:id FOR UPDATE');
    $updateIngredient = $pdo->prepare(
        'UPDATE ingredients SET stock_quantity=:stock,cost=:cost,updated_at=NOW() WHERE id=:id'
    );
    $insertItem = $pdo->prepare(
        'INSERT INTO inventory_receipt_items (
            receipt_id,product_id,ingredient_id,product_code,product_name,unit,quantity,unit_cost,line_total,note
         ) VALUES (
            :receipt_id,NULL,:ingredient_id,:code,:name,:unit,:quantity,:unit_cost,:line_total,:note
         )'
    );
    $insertMovement = $pdo->prepare(
        'INSERT INTO inventory_stock_movements (
            id,receipt_id,receipt_item_id,store_id,product_id,ingredient_id,quantity,stock_before,stock_after,created_by
         ) VALUES (
            :id,:receipt_id,:receipt_item_id,:store_id,NULL,:ingredient_id,:quantity,:stock_before,:stock_after,:created_by
         )'
    );

    foreach ($items as $line) {
        $ingredient = $line['ingredient'];
        $lockIngredient->execute(['id' => $ingredient['id']]);
        $stockBefore = (float) $lockIngredient->fetchColumn();
        $lockIngredient->closeCursor();
        $stockAfter = round($stockBefore + $line['quantity'], 3);

        $insertItem->execute([
            'receipt_id' => $receiptId,
            'ingredient_id' => $ingredient['id'],
            'code' => $ingredient['ingredient_code'],
            'name' => $ingredient['ingredient_name'],
            'unit' => $ingredient['unit'],
            'quantity' => $line['quantity'],
            'unit_cost' => $line['unitCost'],
            'line_total' => $line['lineTotal'],
            'note' => $line['note'] ?: null,
        ]);
        $receiptItemId = (int) $pdo->lastInsertId();
        $updateIngredient->execute([
            'id' => $ingredient['id'],
            'stock' => $stockAfter,
            'cost' => $line['unitCost'],
        ]);
        $insertMovement->execute([
            'id' => uuidv4(),
            'receipt_id' => $receiptId,
            'receipt_item_id' => $receiptItemId,
            'store_id' => $storeId,
            'ingredient_id' => $ingredient['id'],
            'quantity' => $line['quantity'],
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'created_by' => $actorId,
        ]);
    }

    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $exception;
}

$receipt = field_inventory_load_receipt($receiptId);
if (!$receipt) {
    respond_error('Không thể đọc lại phiếu nhập vừa tạo.', 500);
}
respond_ok([
    'item' => field_inventory_receipt_payload(
        $receipt,
        field_inventory_load_items($receiptId),
        [],
        $user
    ),
], 201);
