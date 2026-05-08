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

    db()->exec(
        'CREATE TABLE IF NOT EXISTS inventory_consumptions (
            id VARCHAR(64) PRIMARY KEY,
            store_id VARCHAR(32) NOT NULL,
            source_type ENUM("sales_report") NOT NULL DEFAULT "sales_report",
            source_file_name VARCHAR(255) NOT NULL,
            source_hash CHAR(64) NOT NULL,
            report_start_date DATE NULL,
            report_end_date DATE NULL,
            source_item_count INT NOT NULL DEFAULT 0,
            applied_item_count INT NOT NULL DEFAULT 0,
            total_consumed_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
            total_consumed_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
            note TEXT NULL,
            created_by VARCHAR(255) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_inventory_consumptions_hash (store_id, source_hash),
            KEY idx_inventory_consumptions_store_created (store_id, created_at),
            CONSTRAINT fk_inventory_consumptions_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    db()->exec(
        'CREATE TABLE IF NOT EXISTS inventory_consumption_items (
            id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
            consumption_id VARCHAR(64) NOT NULL,
            product_id VARCHAR(64) NOT NULL,
            product_code VARCHAR(100) NOT NULL,
            product_name VARCHAR(255) NOT NULL,
            consumed_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
            stock_before DECIMAL(15,3) NOT NULL DEFAULT 0,
            stock_after DECIMAL(15,3) NOT NULL DEFAULT 0,
            cost_unit DECIMAL(15,2) NOT NULL DEFAULT 0,
            line_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_inventory_consumption_items_consumption (consumption_id),
            KEY idx_inventory_consumption_items_product (product_id),
            CONSTRAINT fk_inventory_consumption_items_consumption FOREIGN KEY (consumption_id) REFERENCES inventory_consumptions(id) ON DELETE CASCADE,
            CONSTRAINT fk_inventory_consumption_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    db()->exec(
        'CREATE TABLE IF NOT EXISTS inventory_checks (
            id VARCHAR(64) PRIMARY KEY,
            store_id VARCHAR(32) NOT NULL,
            check_code VARCHAR(100) NOT NULL,
            check_date DATE NOT NULL,
            status ENUM("draft", "completed", "cancelled") NOT NULL DEFAULT "draft",
            note TEXT NULL,
            counted_item_count INT NOT NULL DEFAULT 0,
            total_actual_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
            total_variance_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
            increase_quantity_total DECIMAL(15,3) NOT NULL DEFAULT 0,
            decrease_quantity_total DECIMAL(15,3) NOT NULL DEFAULT 0,
            variance_value_total DECIMAL(15,2) NOT NULL DEFAULT 0,
            completed_at DATETIME NULL,
            completed_by VARCHAR(255) NULL,
            created_by VARCHAR(255) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_inventory_checks_code (store_id, check_code),
            KEY idx_inventory_checks_store_date (store_id, check_date),
            KEY idx_inventory_checks_store_status (store_id, status),
            CONSTRAINT fk_inventory_checks_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    db()->exec(
        'CREATE TABLE IF NOT EXISTS inventory_check_items (
            id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
            check_id VARCHAR(64) NOT NULL,
            product_id VARCHAR(64) NOT NULL,
            product_code VARCHAR(100) NOT NULL,
            product_name VARCHAR(255) NOT NULL,
            system_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
            is_counted TINYINT(1) NOT NULL DEFAULT 0,
            actual_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
            variance_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
            unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
            variance_value DECIMAL(15,2) NOT NULL DEFAULT 0,
            note TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_inventory_check_items_check (check_id),
            KEY idx_inventory_check_items_product (product_id),
            CONSTRAINT fk_inventory_check_items_check FOREIGN KEY (check_id) REFERENCES inventory_checks(id) ON DELETE CASCADE,
            CONSTRAINT fk_inventory_check_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    auth_ensure_column('inventory_check_items', 'is_counted', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER system_quantity');

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

function products_inventory_generate_check_code(string $storeId): string
{
    products_inventory_ensure_schema();

    $prefix = 'KK' . (new DateTimeImmutable('now'))->format('Ymd');

    $statement = db()->prepare(
        'SELECT COUNT(*) FROM inventory_checks WHERE store_id = :store_id AND check_code LIKE :prefix'
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

function products_inventory_apply_check(string $checkId): void
{
    products_inventory_ensure_schema();

    $checkStatement = db()->prepare(
        'SELECT id, status
         FROM inventory_checks
         WHERE id = :id
         LIMIT 1'
    );
    $checkStatement->execute(['id' => $checkId]);
    $check = $checkStatement->fetch();

    if (!$check) {
        throw new RuntimeException('Khong tim thay phieu kiem kho.');
    }

    if ((string) $check['status'] !== 'completed') {
        throw new RuntimeException('Chi co the can bang kho cho phieu da hoan thanh.');
    }

    $itemsStatement = db()->prepare(
        'SELECT product_id, actual_quantity
         FROM inventory_check_items
         WHERE check_id = :check_id'
    );
    $itemsStatement->execute(['check_id' => $checkId]);
    $items = $itemsStatement->fetchAll();

    $lockProduct = db()->prepare(
        'SELECT id
         FROM products
         WHERE id = :id
         LIMIT 1
         FOR UPDATE'
    );
    $updateProduct = db()->prepare(
        'UPDATE products
         SET stock_quantity = :stock_quantity,
             updated_at = NOW()
         WHERE id = :id'
    );

    foreach ($items as $item) {
        $lockProduct->execute([
            'id' => (string) $item['product_id'],
        ]);
        $product = $lockProduct->fetch();
        if (!$product) {
            continue;
        }

        $updateProduct->execute([
            'id' => (string) $item['product_id'],
            'stock_quantity' => round((float) $item['actual_quantity'], 3),
        ]);
    }
}

function products_inventory_normalize_sales_items(array $items): array
{
    $normalized = [];

    foreach ($items as $item) {
        $productCode = trim((string) ($item['productCode'] ?? $item['product_code'] ?? ''));
        $productName = trim((string) ($item['productName'] ?? $item['product_name'] ?? ''));
        $quantity = products_inventory_parse_decimal($item['quantity'] ?? null);

        if ($productCode === '' || $quantity <= 0) {
            continue;
        }

        $normalized[] = [
            'productCode' => $productCode,
            'productName' => $productName,
            'quantity' => $quantity,
        ];
    }

    usort(
        $normalized,
        static function (array $left, array $right): int {
            return strcmp($left['productCode'], $right['productCode']);
        }
    );

    return $normalized;
}

function products_inventory_build_consumption_source_hash(
    string $storeId,
    string $fileName,
    ?string $startDate,
    ?string $endDate,
    array $salesItems
): string {
    return hash(
        'sha256',
        json_encode(
            [
                'storeId' => $storeId,
                'fileName' => $fileName,
                'startDate' => $startDate,
                'endDate' => $endDate,
                'salesItems' => $salesItems,
            ],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        )
    );
}

function products_inventory_resolve_consumption_preview(string $storeId, array $salesItems): array
{
    products_inventory_ensure_schema();

    $normalizedSalesItems = products_inventory_normalize_sales_items($salesItems);

    if ($normalizedSalesItems === []) {
        return [
            'salesItems' => [],
            'items' => [],
            'errors' => [],
            'totalConsumedQuantity' => 0.0,
            'totalConsumedCost' => 0.0,
        ];
    }

    $productsStatement = db()->prepare(
        'SELECT id, product_code, product_name, cost, stock_quantity
         FROM products
         WHERE store_id = :store_id'
    );
    $productsStatement->execute([
        'store_id' => $storeId,
    ]);

    $productsById = [];
    $productsByCode = [];

    foreach ($productsStatement->fetchAll() as $row) {
        $productId = (string) $row['id'];
        $productCode = (string) $row['product_code'];
        $product = [
            'id' => $productId,
            'productCode' => $productCode,
            'productName' => (string) $row['product_name'],
            'cost' => $row['cost'] !== null ? (float) $row['cost'] : 0.0,
            'stockQuantity' => $row['stock_quantity'] !== null ? (float) $row['stock_quantity'] : 0.0,
        ];

        $productsById[$productId] = $product;
        $productsByCode[$productCode] = $product;
    }

    $componentStatement = db()->prepare(
        'SELECT pc.product_id, component.id AS component_id, component.product_code, component.product_name, component.cost, component.stock_quantity, pc.quantity
         FROM product_components pc
         INNER JOIN products component ON component.id = pc.component_product_id
         WHERE pc.store_id = :store_id'
    );
    $componentStatement->execute([
        'store_id' => $storeId,
    ]);

    $componentsByProductId = [];
    foreach ($componentStatement->fetchAll() as $row) {
        $productId = (string) $row['product_id'];
        $componentsByProductId[$productId][] = [
            'id' => (string) $row['component_id'],
            'productCode' => (string) $row['product_code'],
            'productName' => (string) $row['product_name'],
            'cost' => $row['cost'] !== null ? (float) $row['cost'] : 0.0,
            'stockQuantity' => $row['stock_quantity'] !== null ? (float) $row['stock_quantity'] : 0.0,
            'quantity' => (float) $row['quantity'],
        ];
    }

    $aggregated = [];
    $errors = [];

    $walk = static function (array $product, float $quantity, array $path = []) use (
        &$walk,
        &$aggregated,
        &$errors,
        $componentsByProductId,
        $productsById
    ): void {
        if ($quantity <= 0) {
            return;
        }

        if (in_array($product['id'], $path, true)) {
            $errors[] = sprintf('Phát hiện vòng lặp công thức tại mã %s.', $product['productCode']);
            return;
        }

        $components = $componentsByProductId[$product['id']] ?? [];
        if ($components !== []) {
            $nextPath = array_merge($path, [$product['id']]);

            foreach ($components as $component) {
                $childQuantity = $quantity * (float) $component['quantity'];
                $childProduct = $productsById[$component['id']] ?? null;
                if (!$childProduct) {
                    $errors[] = sprintf(
                        'Thiếu hàng hoá thành phần %s trong công thức của %s.',
                        $component['productCode'],
                        $product['productCode']
                    );
                    continue;
                }

                $walk($childProduct, $childQuantity, $nextPath);
            }

            return;
        }

        $productId = $product['id'];
        if (!isset($aggregated[$productId])) {
            $aggregated[$productId] = [
                'productId' => $productId,
                'productCode' => $product['productCode'],
                'productName' => $product['productName'],
                'quantity' => 0.0,
                'stockBefore' => (float) $product['stockQuantity'],
                'costUnit' => (float) $product['cost'],
            ];
        }

        $aggregated[$productId]['quantity'] += $quantity;
    };

    foreach ($normalizedSalesItems as $salesItem) {
        $product = $productsByCode[$salesItem['productCode']] ?? null;
        if (!$product) {
            $errors[] = sprintf('Không tìm thấy hàng hoá %s để trừ kho.', $salesItem['productCode']);
            continue;
        }

        $walk($product, (float) $salesItem['quantity']);
    }

    $items = array_values(
        array_map(
            static function (array $item): array {
                $quantity = round((float) $item['quantity'], 3);
                $stockBefore = round((float) $item['stockBefore'], 3);
                $costUnit = round((float) $item['costUnit'], 2);
                $stockAfter = round($stockBefore - $quantity, 3);

                return [
                    'productId' => $item['productId'],
                    'productCode' => $item['productCode'],
                    'productName' => $item['productName'],
                    'quantity' => $quantity,
                    'stockBefore' => $stockBefore,
                    'stockAfter' => $stockAfter,
                    'costUnit' => $costUnit,
                    'lineCost' => round($quantity * $costUnit, 2),
                ];
            },
            $aggregated
        )
    );

    usort(
        $items,
        static function (array $left, array $right): int {
            return strcmp($left['productCode'], $right['productCode']);
        }
    );

    return [
        'salesItems' => $normalizedSalesItems,
        'items' => $items,
        'errors' => array_values(array_unique($errors)),
        'totalConsumedQuantity' => round(
            array_reduce(
                $items,
                static fn (float $sum, array $item): float => $sum + (float) $item['quantity'],
                0.0
            ),
            3
        ),
        'totalConsumedCost' => round(
            array_reduce(
                $items,
                static fn (float $sum, array $item): float => $sum + (float) $item['lineCost'],
                0.0
            ),
            2
        ),
    ];
}

function products_inventory_list_consumptions(string $storeId, int $limit = 10): array
{
    products_inventory_ensure_schema();

    $statement = db()->prepare(
        'SELECT *
         FROM inventory_consumptions
         WHERE store_id = :store_id
         ORDER BY created_at DESC
         LIMIT :limit'
    );
    $statement->bindValue(':store_id', $storeId, PDO::PARAM_STR);
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->execute();

    return array_map(
        static function (array $row): array {
            return [
                'id' => (string) $row['id'],
                'storeId' => (string) $row['store_id'],
                'sourceType' => (string) $row['source_type'],
                'sourceFileName' => (string) $row['source_file_name'],
                'reportStartDate' => $row['report_start_date'] ?: null,
                'reportEndDate' => $row['report_end_date'] ?: null,
                'sourceItemCount' => (int) $row['source_item_count'],
                'appliedItemCount' => (int) $row['applied_item_count'],
                'totalConsumedQuantity' => (float) $row['total_consumed_quantity'],
                'totalConsumedCost' => (float) $row['total_consumed_cost'],
                'note' => $row['note'] !== null ? (string) $row['note'] : '',
                'createdBy' => $row['created_by'] !== null ? (string) $row['created_by'] : '',
                'createdAt' => (string) $row['created_at'],
            ];
        },
        $statement->fetchAll()
    );
}

function products_inventory_apply_sales_consumption(
    string $storeId,
    string $fileName,
    ?string $startDate,
    ?string $endDate,
    array $salesItems,
    string $createdBy,
    string $note = ''
): array {
    products_inventory_ensure_schema();

    $preview = products_inventory_resolve_consumption_preview($storeId, $salesItems);
    if ($preview['items'] === []) {
        throw new RuntimeException('Không có nguyên liệu hợp lệ để trừ kho.');
    }

    $sourceHash = products_inventory_build_consumption_source_hash(
        $storeId,
        $fileName,
        $startDate,
        $endDate,
        $preview['salesItems']
    );

    $existingStatement = db()->prepare(
        'SELECT id
         FROM inventory_consumptions
         WHERE store_id = :store_id
           AND source_hash = :source_hash
         LIMIT 1'
    );
    $existingStatement->execute([
        'store_id' => $storeId,
        'source_hash' => $sourceHash,
    ]);
    $existingId = $existingStatement->fetchColumn();
    if ($existingId) {
        throw new RuntimeException('Báo cáo này đã được trừ kho trước đó.');
    }

    $consumptionId = uuidv4();
    $insertConsumption = db()->prepare(
        'INSERT INTO inventory_consumptions (
            id, store_id, source_type, source_file_name, source_hash, report_start_date, report_end_date,
            source_item_count, applied_item_count, total_consumed_quantity, total_consumed_cost, note, created_by
         ) VALUES (
            :id, :store_id, "sales_report", :source_file_name, :source_hash, :report_start_date, :report_end_date,
            :source_item_count, :applied_item_count, :total_consumed_quantity, :total_consumed_cost, :note, :created_by
         )'
    );
    $insertConsumptionItem = db()->prepare(
        'INSERT INTO inventory_consumption_items (
            consumption_id, product_id, product_code, product_name, consumed_quantity, stock_before, stock_after, cost_unit, line_cost
         ) VALUES (
            :consumption_id, :product_id, :product_code, :product_name, :consumed_quantity, :stock_before, :stock_after, :cost_unit, :line_cost
         )'
    );
    $lockProduct = db()->prepare(
        'SELECT id, stock_quantity
         FROM products
         WHERE id = :id
         LIMIT 1
         FOR UPDATE'
    );
    $updateProduct = db()->prepare(
        'UPDATE products
         SET stock_quantity = :stock_quantity,
             updated_at = NOW()
         WHERE id = :id'
    );

    db()->beginTransaction();

    try {
        $insertConsumption->execute([
            'id' => $consumptionId,
            'store_id' => $storeId,
            'source_file_name' => $fileName,
            'source_hash' => $sourceHash,
            'report_start_date' => $startDate ?: null,
            'report_end_date' => $endDate ?: null,
            'source_item_count' => count($preview['salesItems']),
            'applied_item_count' => count($preview['items']),
            'total_consumed_quantity' => $preview['totalConsumedQuantity'],
            'total_consumed_cost' => $preview['totalConsumedCost'],
            'note' => $note,
            'created_by' => $createdBy,
        ]);

        foreach ($preview['items'] as $item) {
            $lockProduct->execute([
                'id' => (string) $item['productId'],
            ]);
            $productRow = $lockProduct->fetch();
            if (!$productRow) {
                throw new RuntimeException(sprintf('Không tìm thấy nguyên liệu %s để cập nhật tồn kho.', $item['productCode']));
            }

            $stockBefore = $productRow['stock_quantity'] !== null ? (float) $productRow['stock_quantity'] : 0.0;
            $stockAfter = round($stockBefore - (float) $item['quantity'], 3);

            $updateProduct->execute([
                'id' => (string) $item['productId'],
                'stock_quantity' => $stockAfter,
            ]);

            $insertConsumptionItem->execute([
                'consumption_id' => $consumptionId,
                'product_id' => (string) $item['productId'],
                'product_code' => (string) $item['productCode'],
                'product_name' => (string) $item['productName'],
                'consumed_quantity' => (float) $item['quantity'],
                'stock_before' => round($stockBefore, 3),
                'stock_after' => $stockAfter,
                'cost_unit' => (float) $item['costUnit'],
                'line_cost' => (float) $item['lineCost'],
            ]);
        }

        db()->commit();
    } catch (Throwable $exception) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }

        throw $exception;
    }

    return [
        'id' => $consumptionId,
        'sourceFileName' => $fileName,
        'reportStartDate' => $startDate,
        'reportEndDate' => $endDate,
        'sourceItemCount' => count($preview['salesItems']),
        'appliedItemCount' => count($preview['items']),
        'totalConsumedQuantity' => $preview['totalConsumedQuantity'],
        'totalConsumedCost' => $preview['totalConsumedCost'],
        'createdBy' => $createdBy,
        'createdAt' => (new DateTimeImmutable())->format('Y-m-d H:i:s'),
        'errors' => $preview['errors'],
        'items' => $preview['items'],
    ];
}
