<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/products_inventory.php';

products_inventory_ensure_schema();

function receipt_item_body(): array
{
    return read_json_body();
}

function receipt_item_find(array $user, int $id): array
{
    $statement = db()->prepare(
        'SELECT i.*, r.store_id, r.status FROM inventory_receipt_items i
         INNER JOIN inventory_receipts r ON r.id=i.receipt_id WHERE i.id=:id LIMIT 1'
    );
    $statement->execute(['id' => $id]);
    $item = $statement->fetch();
    if (!$item) respond_error('Không tìm thấy dòng hàng.', 404);
    field_inventory_require_store($user, (string) $item['store_id']);
    return $item;
}

function receipt_item_product(string $storeId, array $body): array
{
    $productId = trim((string) ($body['ingredientId'] ?? $body['productId'] ?? ''));
    $productCode = trim((string) ($body['ingredientCode'] ?? $body['productCode'] ?? ''));
    $statement = db()->prepare(
        'SELECT id,ingredient_code AS product_code,ingredient_name AS product_name,COALESCE(NULLIF(purchase_unit,""),unit) AS unit FROM ingredients
         WHERE store_id=:store_id
           AND is_active=1
           AND (id=:product_id OR ingredient_code=:product_code)
         LIMIT 1'
    );
    $statement->execute(['store_id' => $storeId, 'product_id' => $productId, 'product_code' => $productCode]);
    $product = $statement->fetch();
    if (!$product) respond_error('Sản phẩm không tồn tại tại khu vực này.', 422);
    return $product;
}

function receipt_item_values(array $body): array
{
    $quantity = field_inventory_nullable_decimal($body['quantity'] ?? null);
    $unitPrice = field_inventory_nullable_decimal($body['unitPrice'] ?? $body['unitCost'] ?? null);
    if ($quantity === null || $quantity <= 0 || $unitPrice === null || $unitPrice < 0) {
        respond_error('Số lượng phải lớn hơn 0 và đơn giá không được âm.', 422);
    }
    return [$quantity, $unitPrice, round($quantity * $unitPrice, 2)];
}

function receipt_item_recalculate(string $id): void
{
    $statement = db()->prepare(
        'UPDATE inventory_receipts r
         SET total_quantity=(SELECT COALESCE(SUM(i.quantity),0) FROM inventory_receipt_items i WHERE i.receipt_id=r.id),
             total_amount=(SELECT COALESCE(SUM(i.quantity*i.unit_cost),0) FROM inventory_receipt_items i WHERE i.receipt_id=r.id),
             updated_at=NOW() WHERE r.id=:id'
    );
    $statement->execute(['id' => $id]);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$user = field_inventory_require_permission('inventory_receipts.update');
$body = receipt_item_body();

if ($method === 'POST') {
    $receiptId = trim((string) ($body['receiptId'] ?? ''));
    $receipt = field_inventory_require_receipt($user, $receiptId);
    field_inventory_assert_receipt_editable($user, $receipt);
    if (!in_array($receipt['status'], ['pending_explanation', 'draft'], true)) {
        respond_error('Phiếu đã khóa.', 409);
    }
    $product = receipt_item_product((string) $receipt['store_id'], $body);
    [$quantity, $unitPrice, $lineTotal] = receipt_item_values($body);
    $statement = db()->prepare(
        'INSERT INTO inventory_receipt_items
         (receipt_id,product_id,ingredient_id,product_code,product_name,unit,quantity,unit_cost,line_total,note)
         VALUES (:receipt,NULL,:ingredient,:code,:name,:unit,:quantity,:price,:total,:note)'
    );
    $statement->execute([
        'receipt' => $receiptId, 'ingredient' => $product['id'], 'code' => $product['product_code'],
        'name' => $product['product_name'], 'unit' => $product['unit'], 'quantity' => $quantity,
        'price' => $unitPrice, 'total' => $lineTotal, 'note' => trim((string) ($body['note'] ?? '')) ?: null,
    ]);
    receipt_item_recalculate($receiptId);
    respond_ok(['item' => end(field_inventory_load_items($receiptId))], 201);
}

$id = (int) ($_GET['id'] ?? $body['id'] ?? 0);
$existing = receipt_item_find($user, $id);
field_inventory_assert_receipt_editable(
    $user,
    field_inventory_require_receipt($user, (string) $existing['receipt_id'])
);
if (!in_array($existing['status'], ['pending_explanation', 'draft'], true)) {
    respond_error('Phiếu đã khóa.', 409);
}

if (in_array($method, ['PUT', 'PATCH'], true)) {
    $product = receipt_item_product((string) $existing['store_id'], $body + [
        'ingredientId' => $existing['ingredient_id'] ?? $existing['product_id'], 'productCode' => $existing['product_code'],
    ]);
    [$quantity, $unitPrice, $lineTotal] = receipt_item_values($body + [
        'quantity' => $existing['quantity'], 'unitPrice' => $existing['unit_cost'],
    ]);
    $statement = db()->prepare(
        'UPDATE inventory_receipt_items SET product_id=NULL,ingredient_id=:ingredient,product_code=:code,product_name=:name,
         unit=:unit,quantity=:quantity,unit_cost=:price,line_total=:total,note=:note,updated_at=NOW() WHERE id=:id'
    );
    $statement->execute([
        'id' => $id, 'ingredient' => $product['id'], 'code' => $product['product_code'], 'name' => $product['product_name'],
        'unit' => $product['unit'], 'quantity' => $quantity, 'price' => $unitPrice, 'total' => $lineTotal,
        'note' => trim((string) ($body['note'] ?? $existing['note'])) ?: null,
    ]);
    receipt_item_recalculate((string) $existing['receipt_id']);
    respond_ok(['items' => field_inventory_load_items((string) $existing['receipt_id'])]);
}

if ($method === 'DELETE') {
    $statement = db()->prepare('DELETE FROM inventory_receipt_items WHERE id=:id');
    $statement->execute(['id' => $id]);
    receipt_item_recalculate((string) $existing['receipt_id']);
    respond_ok(['deleted' => true]);
}

respond_error('Method not allowed', 405);
