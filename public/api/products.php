<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/products_inventory.php';

function products_find_category_id(string $storeId, ?string $rawCategory): ?string
{
    $value = trim((string) $rawCategory);
    if ($value === '') {
        return null;
    }

    $statement = db()->prepare(
        'SELECT id
         FROM categories
         WHERE store_id = :store_id
           AND (id = :raw_id OR LOWER(name) = LOWER(:raw_name))
         LIMIT 1'
    );
    $statement->execute([
        'store_id' => $storeId,
        'raw_id' => $value,
        'raw_name' => $value,
    ]);
    $row = $statement->fetch();
    if ($row) {
        return (string) $row['id'];
    }

    $id = uuidv4();
    $insert = db()->prepare(
        'INSERT INTO categories (id, store_id, name, description, sort_order, is_hidden)
         VALUES (:id, :store_id, :name, :description, :sort_order, 0)'
    );
    $insert->execute([
        'id' => $id,
        'store_id' => $storeId,
        'name' => $value,
        'description' => '',
        'sort_order' => time(),
    ]);

    return $id;
}

function products_row_to_payload(array $row): array
{
    return [
        'product_code' => (string) $row['product_code'],
        'product_name' => (string) $row['product_name'],
        'cost' => $row['cost'] !== null ? (float) $row['cost'] : null,
        'price' => $row['price'] !== null ? (float) $row['price'] : null,
        'category' => $row['category_id'] ?: '',
        'categoryName' => $row['category_name'] ?: '',
        'has_cost' => (bool) $row['has_cost'],
        'isSelling' => (bool) $row['is_selling'],
        'stockQuantity' => $row['stock_quantity'] !== null ? (float) $row['stock_quantity'] : 0.0,
        'unit' => $row['unit'] !== null ? (string) $row['unit'] : '',
        'description' => $row['description'] !== null ? (string) $row['description'] : '',
        'itemType' => (string) ($row['item_type'] ?? 'product'),
        'storeId' => (string) $row['store_id'],
    ];
}

function products_normalize_item_type(?string $value): string
{
    return strtolower(trim((string) $value)) === 'ingredient' ? 'ingredient' : 'product';
}

function products_normalized_name(string $value): string
{
    $normalized = trim(preg_replace('/\s+/u', ' ', mb_strtolower($value, 'UTF-8')) ?? '');
    if (class_exists('Transliterator')) {
        $transliterator = Transliterator::create('NFD; [:Nonspacing Mark:] Remove; NFC; Latin-ASCII');
        if ($transliterator) {
            $normalized = (string) $transliterator->transliterate($normalized);
        }
    } elseif (function_exists('iconv')) {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', str_replace(['đ', 'Đ'], ['d', 'D'], $normalized));
        if ($ascii !== false) $normalized = $ascii;
    }
    return $normalized;
}

function products_next_sp_code(): string
{
    $statement = db()->query(
        "SELECT product_code
         FROM products
         WHERE UPPER(product_code) REGEXP '^SP[0-9]+$'
         ORDER BY CAST(SUBSTRING(product_code, 3) AS UNSIGNED) DESC,
                  CHAR_LENGTH(SUBSTRING(product_code, 3)) DESC
         LIMIT 1"
    );
    $currentCode = (string) ($statement->fetchColumn() ?: '');
    if ($currentCode === '') {
        return 'SP1';
    }

    $digits = substr($currentCode, 2);
    $nextNumber = (int) $digits + 1;
    return 'SP' . str_pad((string) $nextNumber, strlen($digits), '0', STR_PAD_LEFT);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
products_inventory_ensure_schema();

if ($method === 'GET') {
    $user = auth_require_permission(['product.access', 'dashboard.access', 'inventory_receipts.access', 'inventory_receipts.update', 'bills.access']);

    $fieldAction = strtolower(trim((string) ($_GET['action'] ?? '')));
    $fieldSearch = trim((string) ($_GET['search'] ?? ''));
    $fieldAreaId = trim((string) ($_GET['areaId'] ?? ''));
    $fieldItemType = products_normalize_item_type((string) ($_GET['itemType'] ?? 'product'));
    if ($fieldAction === 'next-code') {
        require_once __DIR__ . '/_lib/field_inventory.php';
        field_inventory_require_store($user, $fieldAreaId);
        respond_ok(['suggestedCode' => products_next_sp_code()]);
    }
    if ($fieldSearch !== '' || $fieldAreaId !== '') {
        require_once __DIR__ . '/_lib/field_inventory.php';
        field_inventory_require_store($user, $fieldAreaId);
        $sql = 'SELECT p.*, c.name AS category_name, s.name AS area_name,
                       CASE WHEN p.store_id=:rank_area_id THEN 0 ELSE 1 END AS area_rank
                FROM products p
                LEFT JOIN categories c ON c.id COLLATE utf8mb4_unicode_ci=p.category_id
                INNER JOIN stores s
                  ON s.id COLLATE utf8mb4_unicode_ci = p.store_id COLLATE utf8mb4_unicode_ci';
        $params = ['rank_area_id' => $fieldAreaId, 'item_type' => $fieldItemType];
        if ($fieldSearch === '') {
            $sql .= ' WHERE p.store_id=:filter_area_id AND p.item_type=:item_type';
            $params['filter_area_id'] = $fieldAreaId;
        } else {
            $needle = '%' . $fieldSearch . '%';
            $sql .= ' WHERE p.item_type=:item_type
                      AND (p.product_name LIKE :name_needle
                           OR p.product_code LIKE :code_needle
                           OR p.normalized_name LIKE :normalized_needle)';
            $params['name_needle'] = $needle;
            $params['code_needle'] = $needle;
            $params['normalized_needle'] = '%' . products_normalized_name($fieldSearch) . '%';
        }
        $sql .= ' ORDER BY area_rank, p.product_name';
        $statement = db()->prepare($sql);
        $statement->execute($params);
        $items = array_map(static fn(array $row): array => [
            'id' => (string) $row['id'],
            'productCode' => (string) $row['product_code'],
            'productName' => (string) $row['product_name'],
            'unit' => $row['unit'] ?: '',
            'categoryId' => $row['category_id'] ?: null,
            'areaId' => (string) $row['store_id'],
            'areaName' => (string) $row['area_name'],
            'attachedToCurrentArea' => (string) $row['store_id'] === $fieldAreaId,
            'similar' => (string) $row['store_id'] !== $fieldAreaId,
            'itemType' => (string) ($row['item_type'] ?? 'product'),
        ], $statement->fetchAll());
        respond_ok([
            'items' => $items,
            'canCreate' => field_inventory_has_permission($user, 'products.create'),
            'suggestedCode' => products_next_sp_code(),
        ]);
    }

    $storeId = trim((string) ($_GET['storeId'] ?? 'cafe'));
    $itemType = products_normalize_item_type((string) ($_GET['itemType'] ?? 'product'));
    $statement = db()->prepare(
        'SELECT p.*, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON c.id COLLATE utf8mb4_unicode_ci = p.category_id
         WHERE p.store_id = :store_id
           AND p.item_type = :item_type
         ORDER BY p.product_name ASC'
    );
    $statement->execute([
        'store_id' => $storeId,
        'item_type' => $itemType,
    ]);

    $rows = $statement->fetchAll();
    $componentsByProductId = products_inventory_load_components(
        $storeId,
        array_values(
            array_map(
                static function (array $row): string {
                    return (string) $row['id'];
                },
                $rows
            )
        )
    );

    $items = array_map(
        static function (array $row) use ($componentsByProductId): array {
            $payload = products_row_to_payload($row);
            $components = $componentsByProductId[(string) $row['id']] ?? [];
            $payload['components'] = $components;
            $payload['componentCount'] = count($components);
            $payload['componentCostTotal'] = array_reduce(
                $components,
                static function (float $sum, array $component): float {
                    return $sum + (float) ($component['lineTotal'] ?? 0);
                },
                0.0
            );

            return $payload;
        },
        $rows
    );

    respond_ok([
        'items' => $items,
    ]);
}

if ($method === 'POST') {
    $user = auth_require_permission(['product.access', 'dashboard.access', 'products.create']);

    $body = read_json_body();
    $action = strtolower((string) ($body['action'] ?? 'create'));
    $storeId = trim((string) ($body['areaId'] ?? $body['storeId'] ?? 'cafe'));
    $itemType = products_normalize_item_type((string) ($body['itemType'] ?? 'product'));

    if ($action === 'import-selling-menu') {
        if (($user['role'] ?? '') !== 'admin') {
            respond_error('Chỉ quản trị viên được import danh sách món bán', 403);
        }

        $items = is_array($body['items'] ?? null) ? $body['items'] : [];
        if ($items === []) {
            respond_error('Danh sách món import đang trống', 422);
        }

        $statement = db()->prepare(
            'INSERT INTO products (
                id, store_id, product_code, product_name, category_id, cost, price,
                has_cost, is_selling, stock_quantity, item_type
             ) VALUES (
                :id, :store_id, :product_code, :product_name, :category_id, NULL, :price,
                0, :is_selling, 0, :item_type
             )
             ON DUPLICATE KEY UPDATE
                product_name = VALUES(product_name),
                category_id = VALUES(category_id),
                price = VALUES(price),
                is_selling = VALUES(is_selling),
                item_type = VALUES(item_type)'
        );

        $importedCount = 0;
        $sellingCount = 0;
        $stoppedCount = 0;
        db()->beginTransaction();

        try {
            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }

                $productCode = trim((string) ($item['product_code'] ?? ''));
                $productName = trim((string) ($item['product_name'] ?? ''));
                $price = $item['price'] ?? null;
                if ($productCode === '' || $productName === '' || !is_numeric($price)) {
                    continue;
                }

                $isSelling = !empty($item['isSelling']) ? 1 : 0;
                $statement->execute([
                    'id' => uuidv4(),
                    'store_id' => $storeId,
                    'product_code' => $productCode,
                    'product_name' => $productName,
                    'category_id' => products_find_category_id($storeId, (string) ($item['category'] ?? '')),
                    'price' => (float) $price,
                    'is_selling' => $isSelling,
                    'item_type' => 'product',
                ]);

                $importedCount++;
                if ($isSelling === 1) {
                    $sellingCount++;
                } else {
                    $stoppedCount++;
                }
            }

            db()->commit();
        } catch (Throwable $exception) {
            if (db()->inTransaction()) {
                db()->rollBack();
            }
            throw $exception;
        }

        respond_ok([
            'imported' => true,
            'importedCount' => $importedCount,
            'sellingCount' => $sellingCount,
            'stoppedCount' => $stoppedCount,
        ]);
    }

    if ($action === 'import') {
        $items = is_array($body['items'] ?? null) ? $body['items'] : [];
        $statement = db()->prepare(
            'INSERT INTO products (
                id, store_id, product_code, product_name, category_id, cost, price, has_cost, is_selling, stock_quantity, item_type
             ) VALUES (
                :id, :store_id, :product_code, :product_name, :category_id, :cost, :price, :has_cost, :is_selling, :stock_quantity, :item_type
             )
             ON DUPLICATE KEY UPDATE
                product_name = VALUES(product_name),
                category_id = VALUES(category_id),
                cost = VALUES(cost),
                price = VALUES(price),
                has_cost = VALUES(has_cost),
                is_selling = VALUES(is_selling),
                stock_quantity = VALUES(stock_quantity),
                item_type = VALUES(item_type)'
        );

        $preparedComponents = [];

        foreach ($items as $item) {
            $productCode = trim((string) ($item['product_code'] ?? ''));
            $productName = trim((string) ($item['product_name'] ?? ''));
            if ($productCode === '' || $productName === '') {
                continue;
            }

            $categoryId = products_find_category_id($storeId, (string) ($item['category'] ?? ''));
            $price = $item['price'] ?? null;
            $cost = $item['cost'] ?? null;
            $stockQuantity = $item['stockQuantity'] ?? 0;
            $isSelling = array_key_exists('isSelling', $item) ? (!empty($item['isSelling']) ? 1 : 0) : 1;

            $statement->execute([
                'id' => uuidv4(),
                'store_id' => $storeId,
                'product_code' => $productCode,
                'product_name' => $productName,
                'category_id' => $categoryId,
                'cost' => is_numeric($cost) ? (float) $cost : null,
                'price' => is_numeric($price) ? (float) $price : null,
                'has_cost' => is_numeric($cost) ? 1 : 0,
                'is_selling' => $isSelling,
                'stock_quantity' => is_numeric($stockQuantity) ? round((float) $stockQuantity, 3) : 0,
                'item_type' => products_normalize_item_type((string) ($item['itemType'] ?? $itemType)),
            ]);

            if (array_key_exists('components', $item) && is_array($item['components'])) {
                $preparedComponents[] = [
                    'productCode' => $productCode,
                    'components' => $item['components'],
                ];
            }
        }

        foreach ($preparedComponents as $componentSet) {
            $productRow = products_inventory_find_product($storeId, (string) $componentSet['productCode']);
            if (!$productRow) {
                continue;
            }

            products_inventory_replace_components(
                $storeId,
                (string) $productRow['id'],
                (string) $productRow['product_code'],
                is_array($componentSet['components']) ? $componentSet['components'] : []
            );
        }

        respond_ok([
            'imported' => true,
        ]);
    }

    if ($action === 'normalize-categories') {
        respond_ok([
            'updatedProductCount' => 0,
            'createdCategoryCount' => 0,
        ]);
    }

    $productCode = trim((string) ($body['product_code'] ?? $body['productCode'] ?? ''));
    $productName = trim((string) ($body['product_name'] ?? $body['productName'] ?? ''));
    if ($productCode === '' || $productName === '') {
        respond_error('Missing product code or name', 422);
    }

    require_once __DIR__ . '/_lib/field_inventory.php';
    field_inventory_require_store($user, $storeId);
    $normalizedName = products_normalized_name($productName);
    $duplicate = db()->prepare(
        'SELECT id,store_id,product_code,product_name,unit FROM products
         WHERE LOWER(product_code)=LOWER(:code)
            OR (item_type=:item_type AND (
                normalized_name=:normalized
                OR LOWER(TRIM(product_name))=LOWER(TRIM(:name))
            ))
         LIMIT 1'
    );
    $duplicate->execute(['code' => $productCode, 'item_type' => $itemType, 'normalized' => $normalizedName, 'name' => $productName]);
    if ($similar = $duplicate->fetch()) {
        respond_error('Sản phẩm tương tự đã tồn tại.', 409, ['similarProduct' => $similar]);
    }
    $components = is_array($body['components'] ?? null) ? $body['components'] : [];
    $categoryId = products_find_category_id($storeId, (string) ($body['category'] ?? ''));
    $productId = uuidv4();
    db()->beginTransaction();

    try {
        $statement = db()->prepare(
            'INSERT INTO products (
                id, store_id, product_code, product_name, normalized_name, category_id, cost, price, has_cost, is_selling, stock_quantity, item_type, unit, description
             ) VALUES (
                :id, :store_id, :product_code, :product_name, :normalized_name, :category_id, :cost, :price, :has_cost, :is_selling, :stock_quantity, :item_type, :unit, :description
             )'
        );
        $statement->execute([
            'id' => $productId,
            'store_id' => $storeId,
            'product_code' => $productCode,
            'product_name' => $productName,
            'normalized_name' => $normalizedName,
            'category_id' => $categoryId,
            'cost' => is_numeric($body['cost'] ?? null) ? (float) $body['cost'] : null,
            'price' => is_numeric($body['price'] ?? null) ? (float) $body['price'] : null,
            'has_cost' => !empty($body['has_cost']) || is_numeric($body['cost'] ?? null) ? 1 : 0,
            'is_selling' => array_key_exists('isSelling', $body) ? (!empty($body['isSelling']) ? 1 : 0) : 1,
            'stock_quantity' => products_inventory_parse_decimal($body['stockQuantity'] ?? 0),
            'item_type' => $itemType,
            'unit' => trim((string) ($body['unit'] ?? '')) ?: null,
            'description' => trim((string) ($body['description'] ?? '')) ?: null,
        ]);

        products_inventory_replace_components($storeId, $productId, $productCode, $components);
        db()->commit();
    } catch (Throwable $exception) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }

        throw $exception;
    }

    respond_ok(['created' => true, 'item' => [
        'id' => $productId, 'productCode' => $productCode, 'productName' => $productName,
        'unit' => trim((string) ($body['unit'] ?? '')), 'areaId' => $storeId,
        'itemType' => $itemType,
    ]], 201);
}

if ($method === 'PATCH') {
    auth_require_permission(['product.access', 'dashboard.access']);

    $body = read_json_body();
    $storeId = trim((string) ($body['storeId'] ?? 'cafe'));
    $productCode = trim((string) ($body['productCode'] ?? ''));
    if ($productCode === '') {
        respond_error('Product code is required', 422);
    }

    $fields = [];
    $params = [
        'store_id' => $storeId,
        'product_code' => $productCode,
    ];

    if (array_key_exists('cost', $body)) {
        $fields[] = 'cost = :cost';
        $fields[] = 'has_cost = :has_cost';
        $params['cost'] = is_numeric($body['cost']) ? (float) $body['cost'] : null;
        $params['has_cost'] = is_numeric($body['cost']) ? 1 : 0;
    }

    if (array_key_exists('price', $body)) {
        $fields[] = 'price = :price';
        $params['price'] = is_numeric($body['price']) ? (float) $body['price'] : null;
    }

    if (array_key_exists('productName', $body)) {
        $fields[] = 'product_name = :product_name';
        $params['product_name'] = trim((string) $body['productName']);
    }

    if (array_key_exists('category', $body)) {
        $fields[] = 'category_id = :category_id';
        $params['category_id'] = products_find_category_id($storeId, (string) $body['category']);
    }

    if (array_key_exists('isSelling', $body)) {
        $fields[] = 'is_selling = :is_selling';
        $params['is_selling'] = !empty($body['isSelling']) ? 1 : 0;
    }

    if (array_key_exists('stockQuantity', $body)) {
        $fields[] = 'stock_quantity = :stock_quantity';
        $params['stock_quantity'] = products_inventory_parse_decimal($body['stockQuantity'] ?? 0);
    }

    if (array_key_exists('unit', $body)) {
        $fields[] = 'unit = :unit';
        $params['unit'] = trim((string) $body['unit']) ?: null;
    }

    if (array_key_exists('description', $body)) {
        $fields[] = 'description = :description';
        $params['description'] = trim((string) $body['description']) ?: null;
    }

    if (array_key_exists('itemType', $body)) {
        $fields[] = 'item_type = :item_type';
        $params['item_type'] = products_normalize_item_type((string) $body['itemType']);
    }

    $hasComponents = array_key_exists('components', $body);

    if ($fields === [] && !$hasComponents) {
        respond_error('No changes provided', 422);
    }

    $findStatement = db()->prepare(
        'SELECT id, product_code
         FROM products
         WHERE store_id = :store_id
           AND product_code = :product_code
         LIMIT 1'
    );
    $findStatement->execute([
        'store_id' => $storeId,
        'product_code' => $productCode,
    ]);
    $product = $findStatement->fetch();

    if (!$product) {
        respond_error('Không tìm thấy hàng hoá.', 404);
    }

    db()->beginTransaction();

    try {
        if ($fields !== []) {
            $statement = db()->prepare(
                sprintf(
                    'UPDATE products SET %s WHERE store_id = :store_id AND product_code = :product_code',
                    implode(', ', $fields)
                )
            );
            $statement->execute($params);
        }

        if ($hasComponents) {
            $components = is_array($body['components']) ? $body['components'] : [];
            products_inventory_replace_components(
                $storeId,
                (string) $product['id'],
                (string) $product['product_code'],
                $components
            );
        }

        db()->commit();
    } catch (Throwable $exception) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }

        throw $exception;
    }

    respond_ok([
        'updated' => true,
    ]);
}

if ($method === 'DELETE') {
    auth_require_permission(['product.access', 'dashboard.access']);

    $storeId = trim((string) ($_GET['storeId'] ?? 'cafe'));
    $productCode = trim((string) ($_GET['productCode'] ?? ''));
    if ($productCode === '') {
        respond_error('Product code is required', 422);
    }

    $statement = db()->prepare(
        'DELETE FROM products WHERE store_id = :store_id AND product_code = :product_code'
    );
    $statement->execute([
        'store_id' => $storeId,
        'product_code' => $productCode,
    ]);

    respond_ok([
        'deleted' => true,
    ]);
}

respond_error('Not found', 404);
