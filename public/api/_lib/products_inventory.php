<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';

function products_inventory_ensure_schema(): void
{
    static $ensured = false;

    if ($ensured) {
        return;
    }

    auth_ensure_column('products', 'stock_quantity', 'DECIMAL(15,3) NOT NULL DEFAULT 0 AFTER is_selling');

    db()->exec(
        'CREATE TABLE IF NOT EXISTS product_components (
            id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
            store_id VARCHAR(32) NOT NULL,
            product_id VARCHAR(64) NOT NULL,
            component_product_id VARCHAR(64) NOT NULL,
            quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_product_component (product_id, component_product_id),
            KEY idx_product_components_store (store_id),
            KEY idx_product_components_product (product_id),
            KEY idx_product_components_component (component_product_id),
            CONSTRAINT fk_product_components_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
            CONSTRAINT fk_product_components_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            CONSTRAINT fk_product_components_component FOREIGN KEY (component_product_id) REFERENCES products(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    db()->exec(
        'CREATE TABLE IF NOT EXISTS inventory_receipts (
            id VARCHAR(64) PRIMARY KEY,
            store_id VARCHAR(32) NOT NULL,
            receipt_code VARCHAR(100) NOT NULL,
            receipt_date DATE NOT NULL,
            status ENUM("draft", "completed") NOT NULL DEFAULT "draft",
            note TEXT NULL,
            total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            completed_at DATETIME NULL,
            completed_by VARCHAR(255) NULL,
            created_by VARCHAR(255) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_inventory_receipts_code (store_id, receipt_code),
            KEY idx_inventory_receipts_store_date (store_id, receipt_date),
            KEY idx_inventory_receipts_store_status (store_id, status),
            CONSTRAINT fk_inventory_receipts_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    db()->exec(
        'CREATE TABLE IF NOT EXISTS inventory_receipt_items (
            id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
            receipt_id VARCHAR(64) NOT NULL,
            product_id VARCHAR(64) NOT NULL,
            product_code VARCHAR(100) NOT NULL,
            product_name VARCHAR(255) NOT NULL,
            quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
            unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
            line_total DECIMAL(15,2) NOT NULL DEFAULT 0,
            note TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_inventory_receipt_items_receipt (receipt_id),
            KEY idx_inventory_receipt_items_product (product_id),
            CONSTRAINT fk_inventory_receipt_items_receipt FOREIGN KEY (receipt_id) REFERENCES inventory_receipts(id) ON DELETE CASCADE,
            CONSTRAINT fk_inventory_receipt_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $ensured = true;
}

function products_inventory_parse_decimal($value, int $scale = 3): float
{
    if (is_string($value)) {
        $value = str_replace(',', '.', trim($value));
    }

    if (!is_numeric($value)) {
        return 0.0;
    }

    return round((float) $value, $scale);
}

function products_inventory_find_product(string $storeId, string $productCode): ?array
{
    products_inventory_ensure_schema();

    $statement = db()->prepare(
        'SELECT p.*, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.store_id = :store_id
           AND p.product_code = :product_code
         LIMIT 1'
    );
    $statement->execute([
        'store_id' => $storeId,
        'product_code' => $productCode,
    ]);

    $row = $statement->fetch();
    return $row ?: null;
}

function products_inventory_replace_components(string $storeId, string $productId, string $productCode, array $components): void
{
    products_inventory_ensure_schema();

    $delete = db()->prepare('DELETE FROM product_components WHERE store_id = :store_id AND product_id = :product_id');
    $delete->execute([
        'store_id' => $storeId,
        'product_id' => $productId,
    ]);

    if ($components === []) {
        return;
    }

    $findComponent = db()->prepare(
        'SELECT id, product_code
         FROM products
         WHERE store_id = :store_id
           AND product_code = :product_code
         LIMIT 1'
    );
    $insert = db()->prepare(
        'INSERT INTO product_components (store_id, product_id, component_product_id, quantity)
         VALUES (:store_id, :product_id, :component_product_id, :quantity)'
    );

    $seen = [];

    foreach ($components as $component) {
        $componentCode = trim((string) ($component['productCode'] ?? ''));
        $quantity = products_inventory_parse_decimal($component['quantity'] ?? null);

        if ($componentCode === '' || $quantity <= 0) {
            continue;
        }

        if (strcasecmp($componentCode, $productCode) === 0) {
            continue;
        }

        $findComponent->execute([
            'store_id' => $storeId,
            'product_code' => $componentCode,
        ]);
        $componentRow = $findComponent->fetch();
        if (!$componentRow) {
            continue;
        }

        $componentProductId = (string) $componentRow['id'];
        if (isset($seen[$componentProductId])) {
            continue;
        }

        $seen[$componentProductId] = true;

        $insert->execute([
            'store_id' => $storeId,
            'product_id' => $productId,
            'component_product_id' => $componentProductId,
            'quantity' => $quantity,
        ]);
    }
}

function products_inventory_load_components(string $storeId, array $productIds): array
{
    products_inventory_ensure_schema();

    if ($productIds === []) {
        return [];
    }

    $placeholders = implode(', ', array_fill(0, count($productIds), '?'));
    $params = array_merge([$storeId], $productIds);

    $statement = db()->prepare(
        sprintf(
            'SELECT
                pc.product_id,
                component.product_code AS component_product_code,
                component.product_name AS component_product_name,
                component.cost AS component_cost,
                component.stock_quantity AS component_stock_quantity,
                pc.quantity
             FROM product_components pc
             INNER JOIN products parent ON parent.id = pc.product_id
             INNER JOIN products component ON component.id = pc.component_product_id
             WHERE pc.store_id = ?
               AND pc.product_id IN (%s)
             ORDER BY component.product_name ASC',
            $placeholders
        )
    );
    $statement->execute($params);

    $grouped = [];

    foreach ($statement->fetchAll() as $row) {
        $productId = (string) $row['product_id'];
        $cost = $row['component_cost'] !== null ? (float) $row['component_cost'] : 0.0;
        $quantity = (float) $row['quantity'];

        $grouped[$productId][] = [
            'productCode' => (string) $row['component_product_code'],
            'productName' => (string) $row['component_product_name'],
            'quantity' => $quantity,
            'cost' => $cost,
            'stockQuantity' => $row['component_stock_quantity'] !== null ? (float) $row['component_stock_quantity'] : 0.0,
            'lineTotal' => round($quantity * $cost, 2),
        ];
    }

    return $grouped;
}

function products_inventory_generate_receipt_code(string $storeId): string
{
    products_inventory_ensure_schema();

    $prefix = 'NK' . (new DateTimeImmutable('now'))->format('Ymd');

    $statement = db()->prepare(
        'SELECT COUNT(*) FROM inventory_receipts WHERE store_id = :store_id AND receipt_code LIKE :prefix'
    );
    $statement->execute([
        'store_id' => $storeId,
        'prefix' => $prefix . '%',
    ]);
    $count = (int) $statement->fetchColumn();

    return sprintf('%s-%03d', $prefix, $count + 1);
}

function products_inventory_apply_receipt(string $receiptId): void
{
    products_inventory_ensure_schema();

    $receiptStatement = db()->prepare(
        'SELECT id, status
         FROM inventory_receipts
         WHERE id = :id
         LIMIT 1'
    );
    $receiptStatement->execute(['id' => $receiptId]);
    $receipt = $receiptStatement->fetch();

    if (!$receipt) {
        throw new RuntimeException('Không tìm thấy phiếu nhập.');
    }

    if ((string) $receipt['status'] !== 'completed') {
        throw new RuntimeException('Chỉ có thể cập nhật tồn kho cho phiếu đã hoàn thành.');
    }

    $itemsStatement = db()->prepare(
        'SELECT product_id, quantity, unit_cost
         FROM inventory_receipt_items
         WHERE receipt_id = :receipt_id'
    );
    $itemsStatement->execute(['receipt_id' => $receiptId]);
    $items = $itemsStatement->fetchAll();

    $productStatement = db()->prepare(
        'SELECT id, cost, stock_quantity
         FROM products
         WHERE id = :id
         LIMIT 1
         FOR UPDATE'
    );
    $updateStatement = db()->prepare(
        'UPDATE products
         SET stock_quantity = :stock_quantity,
             cost = :cost,
             has_cost = :has_cost,
             updated_at = NOW()
         WHERE id = :id'
    );

    foreach ($items as $item) {
        $productStatement->execute(['id' => (string) $item['product_id']]);
        $product = $productStatement->fetch();
        if (!$product) {
            continue;
        }

        $currentStock = $product['stock_quantity'] !== null ? (float) $product['stock_quantity'] : 0.0;
        $currentCost = $product['cost'] !== null ? (float) $product['cost'] : 0.0;
        $receiptQty = (float) $item['quantity'];
        $receiptCost = (float) $item['unit_cost'];
        $nextStock = $currentStock + $receiptQty;

        if ($nextStock <= 0) {
            $nextCost = $receiptCost;
        } elseif ($currentStock <= 0) {
            $nextCost = $receiptCost;
        } else {
            $nextCost = (($currentStock * $currentCost) + ($receiptQty * $receiptCost)) / $nextStock;
        }

        $updateStatement->execute([
            'id' => (string) $product['id'],
            'stock_quantity' => round($nextStock, 3),
            'cost' => round($nextCost, 2),
            'has_cost' => $nextCost > 0 ? 1 : 0,
        ]);
    }
}
