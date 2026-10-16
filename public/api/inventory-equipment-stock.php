<?php
declare(strict_types=1);
require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/field_inventory.php';
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') respond_error('Method not allowed', 405);
$user = auth_require_permission(['inventory_stock.view', 'inventory_receipts.view']);
$store = field_inventory_require_store($user, trim((string) ($_GET['areaId'] ?? '')));
auth_ensure_column('inventory_receipts', 'previous_status', 'VARCHAR(32) NULL');
// Completed receipt lines are the source of truth, including later admin corrections.
$stmt = db()->prepare('SELECT i.product_code productCode,i.product_name productName,i.unit,SUM(i.quantity) quantity,SUM(i.quantity*i.unit_cost) value
 FROM inventory_receipt_items i INNER JOIN inventory_receipts r ON r.id=i.receipt_id
 WHERE r.store_id=:store AND (r.status="completed" OR (r.status="deleted" AND r.previous_status="completed")) AND i.item_type="equipment"
 GROUP BY i.product_code,i.product_name,i.unit ORDER BY i.product_name');
$stmt->execute(['store'=>$store]);
respond_ok(['items'=>array_map(static function(array $row) use ($user): array { $row['quantity']=(float)$row['quantity']; if (field_inventory_is_admin($user)) $row['value']=(float)$row['value']; else unset($row['value']); return $row; }, $stmt->fetchAll())]);
