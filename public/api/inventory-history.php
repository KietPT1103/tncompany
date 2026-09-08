<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/products_inventory.php';

products_inventory_ensure_schema();
ingredients_ensure_schema();
auth_ensure_column('inventory_receipts', 'order_creator_name', 'VARCHAR(255) NULL AFTER store_id');
auth_ensure_column('inventory_receipt_items', 'unit', 'VARCHAR(50) NULL AFTER product_name');
db()->exec('CREATE TABLE IF NOT EXISTS inventory_issues (
    id VARCHAR(64) PRIMARY KEY,store_id VARCHAR(32) NOT NULL,issue_code VARCHAR(100) NOT NULL,
    issue_date DATE NOT NULL,destination VARCHAR(255) NOT NULL DEFAULT "Quầy pha chế",issued_by VARCHAR(255) NULL,
    status ENUM("draft","completed","cancelled") NOT NULL DEFAULT "draft",note TEXT NULL,
    total_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,completed_at DATETIME NULL,completed_by VARCHAR(255) NULL,
    created_by VARCHAR(255) NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_inventory_issues_code (store_id,issue_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
db()->exec('CREATE TABLE IF NOT EXISTS inventory_issue_items (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,issue_id VARCHAR(64) NOT NULL,ingredient_id VARCHAR(64) NOT NULL,
    ingredient_code VARCHAR(100) NOT NULL,ingredient_name VARCHAR(255) NOT NULL,unit VARCHAR(50) NULL,
    quantity DECIMAL(15,3) NOT NULL,stock_before DECIMAL(15,3) NULL,stock_after DECIMAL(15,3) NULL,
    note TEXT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_inventory_issue_items_issue (issue_id),KEY idx_inventory_issue_items_ingredient (ingredient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

$user = auth_require_permission('inventory_history.access');
$storeId = field_inventory_require_store($user, trim((string) ($_GET['storeId'] ?? '')));
$type = strtolower(trim((string) ($_GET['type'] ?? 'all')));
$dateFrom = trim((string) ($_GET['dateFrom'] ?? ''));
$dateTo = trim((string) ($_GET['dateTo'] ?? ''));
$limit = max(1, min(300, (int) ($_GET['limit'] ?? 120)));

if (!in_array($type, ['all', 'receipt', 'issue'], true)) {
    respond_error('Loại lịch sử không hợp lệ.', 422);
}

$rows = [];
if ($type !== 'issue') {
    $sql = 'SELECT "receipt" AS movement_type,r.id,r.receipt_code AS code,r.receipt_date AS movement_date,r.status,r.created_at,
                COALESCE(NULLIF(r.order_creator_name,""),NULLIF(r.created_by,""),"—") AS actor_name,
                COALESCE(NULLIF(s.supplier_name,""),"Chưa gán") AS counterpart,r.note,r.total_amount,
                ri.id AS item_id,ri.product_code AS ingredient_code,ri.product_name AS ingredient_name,
                ri.unit,ri.quantity,ri.unit_cost,ri.line_total,ri.note AS item_note
            FROM inventory_receipts r
            LEFT JOIN suppliers s ON s.id COLLATE utf8mb4_unicode_ci=r.supplier_id COLLATE utf8mb4_unicode_ci
            LEFT JOIN inventory_receipt_items ri ON ri.receipt_id=r.id
            WHERE r.store_id=:store';
    $params = ['store' => $storeId];
    if ($dateFrom !== '') {$sql .= ' AND r.receipt_date>=:date_from'; $params['date_from'] = $dateFrom;}
    if ($dateTo !== '') {$sql .= ' AND r.receipt_date<=:date_to'; $params['date_to'] = $dateTo;}
    $statement = db()->prepare($sql); $statement->execute($params);
    $rows = array_merge($rows, $statement->fetchAll());
}
if ($type !== 'receipt') {
    $sql = 'SELECT "issue" AS movement_type,i.id,i.issue_code AS code,i.issue_date AS movement_date,i.status,i.created_at,
                COALESCE(NULLIF(i.issued_by,""),NULLIF(i.created_by,""),"—") AS actor_name,
                COALESCE(NULLIF(i.destination,""),"Quầy pha chế") AS counterpart,i.note,0 AS total_amount,
                ii.id AS item_id,ii.ingredient_code,ii.ingredient_name,ii.unit,ii.quantity,
                0 AS unit_cost,0 AS line_total,ii.note AS item_note
            FROM inventory_issues i
            LEFT JOIN inventory_issue_items ii ON ii.issue_id=i.id
            WHERE i.store_id=:store';
    $params = ['store' => $storeId];
    if ($dateFrom !== '') {$sql .= ' AND i.issue_date>=:date_from'; $params['date_from'] = $dateFrom;}
    if ($dateTo !== '') {$sql .= ' AND i.issue_date<=:date_to'; $params['date_to'] = $dateTo;}
    $statement = db()->prepare($sql); $statement->execute($params);
    $rows = array_merge($rows, $statement->fetchAll());
}

$grouped = [];
foreach ($rows as $row) {
    $key = (string) $row['movement_type'] . ':' . (string) $row['id'];
    if (!isset($grouped[$key])) {
        $grouped[$key] = [
            'id'=>(string)$row['id'],'type'=>(string)$row['movement_type'],'code'=>(string)$row['code'],
            'date'=>(string)$row['movement_date'],'status'=>(string)$row['status'],'createdAt'=>(string)$row['created_at'],
            'actorName'=>(string)$row['actor_name'],'counterpart'=>(string)$row['counterpart'],
            'note'=>(string)($row['note']??''),'totalAmount'=>(float)($row['total_amount']??0),
            'totalQuantity'=>0.0,'items'=>[],
        ];
    }
    if ($row['item_id'] === null) continue;
    $quantity = (float) $row['quantity'];
    $grouped[$key]['totalQuantity'] += $quantity;
    $grouped[$key]['items'][] = [
        'id'=>(int)$row['item_id'],'ingredientCode'=>(string)$row['ingredient_code'],
        'ingredientName'=>(string)$row['ingredient_name'],'quantity'=>$quantity,
        'unit'=>(string)($row['unit']??''),'unitCost'=>(float)($row['unit_cost']??0),
        'lineTotal'=>(float)($row['line_total']??0),'note'=>(string)($row['item_note']??''),
    ];
}
$items = array_values($grouped);
usort($items, static fn(array $left,array $right):int => strcmp($right['date'].' '.$right['createdAt'],$left['date'].' '.$left['createdAt']));
respond_ok(['items'=>array_slice($items,0,$limit)]);
