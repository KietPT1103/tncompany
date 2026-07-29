<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/ingredients.php';

ingredients_ensure_schema();

function ingredient_payload(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'ingredientCode' => (string) $row['ingredient_code'],
        'ingredientName' => (string) $row['ingredient_name'],
        'unit' => $row['unit'] ?: '',
        'cost' => $row['cost'] !== null ? (float) $row['cost'] : null,
        'stockQuantity' => (float) $row['stock_quantity'],
        'supplierId' => $row['supplier_id'] ?: null,
        'supplierCode' => $row['supplier_code'] ?? null,
        'supplierName' => $row['supplier_name'] ?? null,
        'supplierItemCode' => $row['supplier_item_code'] ?: '',
        'description' => $row['description'] ?: '',
        'isActive' => (bool) $row['is_active'],
        'storeId' => (string) $row['store_id'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $user = auth_require_permission(['product.access', 'inventory_checks.access', 'inventory_receipts.access']);
    $storeId = trim((string) ($_GET['areaId'] ?? $_GET['storeId'] ?? ''));
    field_inventory_require_store($user, $storeId);
    if (strtolower(trim((string) ($_GET['action'] ?? ''))) === 'next-code') {
        respond_ok(['suggestedCode' => ingredients_next_code('NL', 'ingredients', 'ingredient_code')]);
    }
    $search = trim((string) ($_GET['search'] ?? ''));
    $params = ['store_id' => $storeId];
    $sql = 'SELECT i.*,s.supplier_code,s.supplier_name
            FROM ingredients i
            LEFT JOIN suppliers s
              ON s.id COLLATE utf8mb4_unicode_ci=i.supplier_id COLLATE utf8mb4_unicode_ci
            WHERE i.store_id=:store_id';
    if ($search !== '') {
        $sql .= ' AND (i.ingredient_code LIKE :needle OR i.ingredient_name LIKE :needle
                       OR i.normalized_name LIKE :normalized OR s.supplier_name LIKE :needle)';
        $params['needle'] = '%' . $search . '%';
        $params['normalized'] = '%' . ingredients_normalized_name($search) . '%';
    }
    $sql .= ' ORDER BY i.ingredient_name';
    $statement = db()->prepare($sql);
    $statement->execute($params);
    respond_ok([
        'items' => array_map('ingredient_payload', $statement->fetchAll()),
        'canCreate' => field_inventory_has_permission($user, 'products.create'),
        'suggestedCode' => ingredients_next_code('NL', 'ingredients', 'ingredient_code'),
    ]);
}

$body = read_json_body();
$user = auth_require_permission(['product.access', 'products.create', 'inventory_receipts.update']);
$storeId = trim((string) ($body['areaId'] ?? $body['storeId'] ?? $_GET['storeId'] ?? ''));
field_inventory_require_store($user, $storeId);

if ($method === 'POST') {
    $code = trim((string) ($body['ingredientCode'] ?? $body['productCode'] ?? ''));
    $name = trim((string) ($body['ingredientName'] ?? $body['productName'] ?? ''));
    if ($code === '' || $name === '') {
        respond_error('Vui lòng nhập mã và tên nguyên liệu.', 422);
    }
    $duplicate = db()->prepare(
        'SELECT id FROM ingredients
         WHERE store_id=:store_id AND
           (LOWER(ingredient_code)=LOWER(:code) OR normalized_name=:normalized) LIMIT 1'
    );
    $duplicate->execute([
        'store_id' => $storeId, 'code' => $code, 'normalized' => ingredients_normalized_name($name),
    ]);
    if ($duplicate->fetchColumn()) {
        respond_error('Mã hoặc tên nguyên liệu đã tồn tại trong khu vực.', 409);
    }
    $supplierId = trim((string) ($body['supplierId'] ?? '')) ?: null;
    if ($supplierId) {
        $supplier = db()->prepare('SELECT 1 FROM suppliers WHERE id=:id AND store_id=:store_id LIMIT 1');
        $supplier->execute(['id' => $supplierId, 'store_id' => $storeId]);
        if (!$supplier->fetchColumn()) respond_error('Nhà phân phối không thuộc khu vực này.', 422);
    }
    $id = uuidv4();
    $statement = db()->prepare(
        'INSERT INTO ingredients
         (id,store_id,ingredient_code,ingredient_name,normalized_name,unit,cost,stock_quantity,
          supplier_id,supplier_item_code,description,is_active)
         VALUES
         (:id,:store_id,:code,:name,:normalized,:unit,:cost,:stock,:supplier,:supplier_item_code,:description,:active)'
    );
    $statement->execute([
        'id' => $id, 'store_id' => $storeId, 'code' => $code, 'name' => $name,
        'normalized' => ingredients_normalized_name($name),
        'unit' => trim((string) ($body['unit'] ?? '')) ?: null,
        'cost' => is_numeric($body['cost'] ?? null) ? (float) $body['cost'] : null,
        'stock' => is_numeric($body['stockQuantity'] ?? null) ? round((float) $body['stockQuantity'], 3) : 0,
        'supplier' => $supplierId,
        'supplier_item_code' => trim((string) ($body['supplierItemCode'] ?? '')) ?: null,
        'description' => trim((string) ($body['description'] ?? '')) ?: null,
        'active' => array_key_exists('isActive', $body) && !$body['isActive'] ? 0 : 1,
    ]);
    respond_ok(['created' => true, 'item' => ingredient_payload(ingredients_find($storeId, $id) ?: [])], 201);
}

$code = trim((string) ($body['ingredientCode'] ?? $_GET['ingredientCode'] ?? ''));
$existing = ingredients_find($storeId, $code);
if (!$existing) respond_error('Không tìm thấy nguyên liệu.', 404);

if (in_array($method, ['PUT', 'PATCH'], true)) {
    $name = trim((string) ($body['ingredientName'] ?? $existing['ingredient_name']));
    $supplierId = array_key_exists('supplierId', $body)
        ? (trim((string) $body['supplierId']) ?: null)
        : ($existing['supplier_id'] ?: null);
    $statement = db()->prepare(
        'UPDATE ingredients SET ingredient_name=:name,normalized_name=:normalized,unit=:unit,cost=:cost,
          stock_quantity=:stock,supplier_id=:supplier,supplier_item_code=:supplier_item_code,
          description=:description,is_active=:active,updated_at=NOW()
         WHERE id=:id'
    );
    $statement->execute([
        'id' => $existing['id'], 'name' => $name, 'normalized' => ingredients_normalized_name($name),
        'unit' => trim((string) ($body['unit'] ?? $existing['unit'])) ?: null,
        'cost' => is_numeric($body['cost'] ?? $existing['cost']) ? (float) ($body['cost'] ?? $existing['cost']) : null,
        'stock' => is_numeric($body['stockQuantity'] ?? $existing['stock_quantity'])
            ? round((float) ($body['stockQuantity'] ?? $existing['stock_quantity']), 3) : 0,
        'supplier' => $supplierId,
        'supplier_item_code' => trim((string) ($body['supplierItemCode'] ?? $existing['supplier_item_code'])) ?: null,
        'description' => trim((string) ($body['description'] ?? $existing['description'])) ?: null,
        'active' => array_key_exists('isActive', $body) ? ($body['isActive'] ? 1 : 0) : (int) $existing['is_active'],
    ]);
    respond_ok(['updated' => true, 'item' => ingredient_payload(ingredients_find($storeId, (string) $existing['id']) ?: $existing)]);
}

if ($method === 'DELETE') {
    $used = db()->prepare(
        'SELECT (SELECT COUNT(*) FROM product_ingredients WHERE ingredient_id=:id)
              + (SELECT COUNT(*) FROM inventory_receipt_items WHERE product_id=:id)'
    );
    $used->execute(['id' => $existing['id']]);
    if ((int) $used->fetchColumn() > 0) {
        db()->prepare('UPDATE ingredients SET is_active=0,updated_at=NOW() WHERE id=:id')
            ->execute(['id' => $existing['id']]);
        respond_ok(['deleted' => false, 'deactivated' => true]);
    }
    db()->prepare('DELETE FROM ingredients WHERE id=:id')->execute(['id' => $existing['id']]);
    respond_ok(['deleted' => true]);
}

respond_error('Method not allowed', 405);

