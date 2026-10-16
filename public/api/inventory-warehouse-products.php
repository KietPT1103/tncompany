<?php
declare(strict_types=1);
require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/products_inventory.php';
products_inventory_ensure_schema();
auth_ensure_column('inventory_receipt_items', 'item_type', "ENUM('ingredient','equipment') NOT NULL DEFAULT 'ingredient' AFTER ingredient_id");
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') respond_error('Method not allowed', 405);
$user = field_inventory_require_permission('inventory_receipts.view');
$store = field_inventory_require_store($user, trim((string) ($_GET['areaId'] ?? '')));
$type = (string) ($_GET['warehouseType'] ?? 'ingredient');
if (!in_array($type, ['ingredient', 'equipment'], true)) respond_error('Loại kho không hợp lệ.', 422);
$search = '%' . trim((string) ($_GET['search'] ?? '')) . '%';
$stmt = db()->prepare('SELECT MAX(i.id) id,i.ingredient_id,i.product_code,i.product_name,i.unit,MAX(r.created_at) last_used
 FROM inventory_receipt_items i INNER JOIN inventory_receipts r ON r.id=i.receipt_id
 LEFT JOIN ingredients p ON p.id=i.ingredient_id AND p.store_id=r.store_id AND p.is_active=1
 WHERE r.store_id=:store AND i.item_type=:type AND r.status IN ("draft","completed")
 AND (i.item_type="equipment" OR p.id IS NOT NULL)
 AND (i.product_name LIKE :name OR i.product_code LIKE :code)
 GROUP BY i.ingredient_id,i.product_code,i.product_name,i.unit ORDER BY last_used DESC LIMIT 30');
$stmt->execute(['store' => $store, 'type' => $type, 'name' => $search, 'code' => $search]);
$items = [];
foreach ($stmt->fetchAll() as $row) {
 $items[] = ['id' => (string) ($row['ingredient_id'] ?: $row['id']), 'productCode' => $row['product_code'],
 'productName' => $row['product_name'], 'unit' => $row['unit'], 'areaId' => $store,
 'areaName' => '', 'attachedToCurrentArea' => true, 'similar' => false];
}
respond_ok(['items' => $items]);
