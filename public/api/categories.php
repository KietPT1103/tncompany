<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

auth_ensure_column(
    'categories',
    'is_preparation_print_enabled',
    'TINYINT(1) NOT NULL DEFAULT 1 AFTER is_hidden'
);
auth_ensure_column(
    'categories',
    'counts_as_cup',
    'TINYINT(1) NULL DEFAULT NULL AFTER is_preparation_print_enabled'
);
auth_ensure_column(
    'bill_items',
    'counts_as_cup',
    'TINYINT(1) NULL DEFAULT NULL AFTER surcharge_total'
);

if ($method === 'GET') {
    auth_require_permission(['categories.access', 'bills.access', 'bar.checkout']);

    $storeId = trim((string) ($_GET['storeId'] ?? 'cafe'));
    $statement = db()->prepare(
        'SELECT id, store_id, name, description, sort_order, is_hidden, is_preparation_print_enabled, counts_as_cup
         FROM categories
         WHERE store_id = :store_id
         ORDER BY name ASC'
    );
    $statement->execute([
        'store_id' => $storeId,
    ]);

    $rows = array_map(
        static function (array $row): array {
            return [
                'id' => (string) $row['id'],
                'storeId' => (string) $row['store_id'],
                'name' => (string) $row['name'],
                'description' => $row['description'] ?: '',
                'order' => $row['sort_order'] !== null ? (int) $row['sort_order'] : null,
                'isHidden' => (bool) $row['is_hidden'],
                'isPreparationPrintEnabled' => (bool) $row['is_preparation_print_enabled'],
                'countsAsCup' => $row['counts_as_cup'] !== null && (bool) $row['counts_as_cup'],
                'isCupCountConfigured' => $row['counts_as_cup'] !== null,
            ];
        },
        $statement->fetchAll()
    );

    respond_ok([
        'items' => $rows,
    ]);
}

if ($method === 'POST') {
    auth_require_permission('categories.access');

    $body = read_json_body();
    $storeId = trim((string) ($body['storeId'] ?? 'cafe'));
    $name = trim((string) ($body['name'] ?? ''));
    $description = trim((string) ($body['description'] ?? ''));
    $isPreparationPrintEnabled = !array_key_exists('isPreparationPrintEnabled', $body)
        || !empty($body['isPreparationPrintEnabled']);
    $countsAsCup = !empty($body['countsAsCup']);

    if ($name === '') {
        respond_error('Category name is required', 422);
    }

    $id = uuidv4();
    $statement = db()->prepare(
        'INSERT INTO categories (id, store_id, name, description, sort_order, is_hidden, is_preparation_print_enabled, counts_as_cup)
         VALUES (:id, :store_id, :name, :description, :sort_order, 0, :is_preparation_print_enabled, :counts_as_cup)'
    );
    $statement->execute([
        'id' => $id,
        'store_id' => $storeId,
        'name' => $name,
        'description' => $description,
        'sort_order' => time(),
        'is_preparation_print_enabled' => $isPreparationPrintEnabled ? 1 : 0,
        'counts_as_cup' => $countsAsCup ? 1 : 0,
    ]);

    respond_ok([
        'id' => $id,
    ], 201);
}

if ($method === 'PATCH') {
    auth_require_permission('categories.access');

    $body = read_json_body();
    $id = trim((string) ($body['id'] ?? ''));
    if ($id === '') {
        respond_error('Category id is required', 422);
    }

    $fields = [];
    $params = ['id' => $id];
    $previousCategory = db()->prepare('SELECT counts_as_cup FROM categories WHERE id = :id LIMIT 1');
    $previousCategory->execute(['id' => $id]);
    $previousCountsAsCup = $previousCategory->fetchColumn();
    if ($previousCountsAsCup === false) {
        respond_error('Category not found', 404);
    }

    if (array_key_exists('name', $body)) {
        $name = trim((string) $body['name']);
        if ($name === '') {
            respond_error('Category name is required', 422);
        }
        $fields[] = 'name = :name';
        $params['name'] = $name;
    }

    if (array_key_exists('description', $body)) {
        $fields[] = 'description = :description';
        $params['description'] = trim((string) $body['description']);
    }

    if (array_key_exists('isHidden', $body)) {
        $fields[] = 'is_hidden = :is_hidden';
        $params['is_hidden'] = !empty($body['isHidden']) ? 1 : 0;
    }

    if (array_key_exists('isPreparationPrintEnabled', $body)) {
        $fields[] = 'is_preparation_print_enabled = :is_preparation_print_enabled';
        $params['is_preparation_print_enabled'] = !empty($body['isPreparationPrintEnabled']) ? 1 : 0;
    }

    if (array_key_exists('countsAsCup', $body)) {
        $fields[] = 'counts_as_cup = :counts_as_cup';
        $params['counts_as_cup'] = !empty($body['countsAsCup']) ? 1 : 0;
    }

    if ($fields === []) {
        respond_error('No changes provided', 422);
    }

    $statement = db()->prepare(
        sprintf('UPDATE categories SET %s WHERE id = :id', implode(', ', $fields))
    );
    $statement->execute($params);

    if (array_key_exists('countsAsCup', $body) && $previousCountsAsCup === null) {
        $backfill = db()->prepare(
            'UPDATE bill_items bi
             INNER JOIN bills b ON b.id = bi.bill_id
             INNER JOIN products p ON p.store_id = b.store_id AND p.product_code = bi.menu_id
             SET bi.counts_as_cup = :counts_as_cup
             WHERE bi.counts_as_cup IS NULL AND p.category_id = :category_id'
        );
        $backfill->execute([
            'counts_as_cup' => !empty($body['countsAsCup']) ? 1 : 0,
            'category_id' => $id,
        ]);
    }

    respond_ok([
        'updated' => true,
    ]);
}

if ($method === 'DELETE') {
    auth_require_permission('categories.access');

    $id = trim((string) ($_GET['id'] ?? ''));
    if ($id === '') {
        respond_error('Category id is required', 422);
    }

    $check = db()->prepare(
        'SELECT COUNT(*) AS total FROM products WHERE category_id = :category_id'
    );
    $check->execute([
        'category_id' => $id,
    ]);
    $total = (int) (($check->fetch()['total'] ?? 0));
    if ($total > 0) {
        respond_error('Category is in use', 409, ['usageCount' => $total]);
    }

    $statement = db()->prepare('DELETE FROM categories WHERE id = :id');
    $statement->execute([
        'id' => $id,
    ]);

    respond_ok([
        'deleted' => true,
    ]);
}

respond_error('Not found', 404);
