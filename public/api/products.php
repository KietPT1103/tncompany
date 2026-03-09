<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';

function products_find_category_id(string $storeId, ?string $rawCategory): ?string
{
    $value = trim((string) $rawCategory);
    if ($value === '') {
        return null;
    }

    $statement = db()->prepare(
        'SELECT id FROM categories WHERE store_id = :store_id AND (id = :raw OR LOWER(name) = LOWER(:raw)) LIMIT 1'
    );
    $statement->execute([
        'store_id' => $storeId,
        'raw' => $value,
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
        'storeId' => (string) $row['store_id'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    auth_require(['admin']);

    $storeId = trim((string) ($_GET['storeId'] ?? 'cafe'));
    $statement = db()->prepare(
        'SELECT p.*, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.store_id = :store_id
         ORDER BY p.product_name ASC'
    );
    $statement->execute([
        'store_id' => $storeId,
    ]);

    respond_ok([
        'items' => array_map('products_row_to_payload', $statement->fetchAll()),
    ]);
}

if ($method === 'POST') {
    auth_require(['admin']);

    $body = read_json_body();
    $action = strtolower((string) ($body['action'] ?? 'create'));
    $storeId = trim((string) ($body['storeId'] ?? 'cafe'));

    if ($action === 'import') {
        $items = is_array($body['items'] ?? null) ? $body['items'] : [];
        $statement = db()->prepare(
            'INSERT INTO products (
                id, store_id, product_code, product_name, category_id, cost, price, has_cost, is_selling
             ) VALUES (
                :id, :store_id, :product_code, :product_name, :category_id, NULL, :price, 0, 1
             )
             ON DUPLICATE KEY UPDATE
                product_name = VALUES(product_name),
                category_id = VALUES(category_id),
                price = VALUES(price)'
        );

        foreach ($items as $item) {
            $productCode = trim((string) ($item['product_code'] ?? ''));
            $productName = trim((string) ($item['product_name'] ?? ''));
            if ($productCode === '' || $productName === '') {
                continue;
            }

            $categoryId = products_find_category_id($storeId, (string) ($item['category'] ?? ''));
            $price = $item['price'];

            $statement->execute([
                'id' => uuidv4(),
                'store_id' => $storeId,
                'product_code' => $productCode,
                'product_name' => $productName,
                'category_id' => $categoryId,
                'price' => is_numeric($price) ? (float) $price : null,
            ]);
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

    $productCode = trim((string) ($body['product_code'] ?? ''));
    $productName = trim((string) ($body['product_name'] ?? ''));
    if ($productCode === '' || $productName === '') {
        respond_error('Missing product code or name', 422);
    }

    $categoryId = products_find_category_id($storeId, (string) ($body['category'] ?? ''));
    $statement = db()->prepare(
        'INSERT INTO products (
            id, store_id, product_code, product_name, category_id, cost, price, has_cost, is_selling
         ) VALUES (
            :id, :store_id, :product_code, :product_name, :category_id, :cost, :price, :has_cost, :is_selling
         )'
    );
    $statement->execute([
        'id' => uuidv4(),
        'store_id' => $storeId,
        'product_code' => $productCode,
        'product_name' => $productName,
        'category_id' => $categoryId,
        'cost' => is_numeric($body['cost'] ?? null) ? (float) $body['cost'] : null,
        'price' => is_numeric($body['price'] ?? null) ? (float) $body['price'] : null,
        'has_cost' => !empty($body['has_cost']) || is_numeric($body['cost'] ?? null) ? 1 : 0,
        'is_selling' => array_key_exists('isSelling', $body) ? (!empty($body['isSelling']) ? 1 : 0) : 1,
    ]);

    respond_ok([
        'created' => true,
    ], 201);
}

if ($method === 'PATCH') {
    auth_require(['admin']);

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

    if (array_key_exists('category', $body)) {
        $fields[] = 'category_id = :category_id';
        $params['category_id'] = products_find_category_id($storeId, (string) $body['category']);
    }

    if (array_key_exists('isSelling', $body)) {
        $fields[] = 'is_selling = :is_selling';
        $params['is_selling'] = !empty($body['isSelling']) ? 1 : 0;
    }

    if ($fields === []) {
        respond_error('No changes provided', 422);
    }

    $statement = db()->prepare(
        sprintf(
            'UPDATE products SET %s WHERE store_id = :store_id AND product_code = :product_code',
            implode(', ', $fields)
        )
    );
    $statement->execute($params);

    respond_ok([
        'updated' => true,
    ]);
}

if ($method === 'DELETE') {
    auth_require(['admin']);

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

