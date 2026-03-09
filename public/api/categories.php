<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    auth_require(['admin']);

    $storeId = trim((string) ($_GET['storeId'] ?? 'cafe'));
    $statement = db()->prepare(
        'SELECT id, store_id, name, description, sort_order, is_hidden
         FROM categories
         WHERE store_id = :store_id
         ORDER BY name ASC'
    );
    $statement->execute([
        'store_id' => $storeId,
    ]);

    $rows = array_map(
        static fn(array $row): array => [
            'id' => (string) $row['id'],
            'storeId' => (string) $row['store_id'],
            'name' => (string) $row['name'],
            'description' => $row['description'] ?: '',
            'order' => $row['sort_order'] !== null ? (int) $row['sort_order'] : null,
            'isHidden' => (bool) $row['is_hidden'],
        ],
        $statement->fetchAll()
    );

    respond_ok([
        'items' => $rows,
    ]);
}

if ($method === 'POST') {
    auth_require(['admin']);

    $body = read_json_body();
    $storeId = trim((string) ($body['storeId'] ?? 'cafe'));
    $name = trim((string) ($body['name'] ?? ''));
    $description = trim((string) ($body['description'] ?? ''));

    if ($name === '') {
        respond_error('Category name is required', 422);
    }

    $id = uuidv4();
    $statement = db()->prepare(
        'INSERT INTO categories (id, store_id, name, description, sort_order, is_hidden)
         VALUES (:id, :store_id, :name, :description, :sort_order, 0)'
    );
    $statement->execute([
        'id' => $id,
        'store_id' => $storeId,
        'name' => $name,
        'description' => $description,
        'sort_order' => time(),
    ]);

    respond_ok([
        'id' => $id,
    ], 201);
}

if ($method === 'PATCH') {
    auth_require(['admin']);

    $body = read_json_body();
    $id = trim((string) ($body['id'] ?? ''));
    if ($id === '') {
        respond_error('Category id is required', 422);
    }

    $fields = [];
    $params = ['id' => $id];

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

    if ($fields === []) {
        respond_error('No changes provided', 422);
    }

    $statement = db()->prepare(
        sprintf('UPDATE categories SET %s WHERE id = :id', implode(', ', $fields))
    );
    $statement->execute($params);

    respond_ok([
        'updated' => true,
    ]);
}

if ($method === 'DELETE') {
    auth_require(['admin']);

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

