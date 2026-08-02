<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/ingredients.php';

ingredients_ensure_schema();

function supplier_payload(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'supplierCode' => (string) $row['supplier_code'],
        'supplierName' => (string) $row['supplier_name'],
        'contactName' => $row['contact_name'] ?: '',
        'phone' => $row['phone'] ?: '',
        'email' => $row['email'] ?: '',
        'address' => $row['address'] ?: '',
        'taxCode' => $row['tax_code'] ?: '',
        'note' => $row['note'] ?: '',
        'isActive' => (bool) $row['is_active'],
        'storeId' => (string) $row['store_id'],
        'ingredientCount' => isset($row['ingredient_count']) ? (int) $row['ingredient_count'] : 0,
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
    $user = auth_require_permission([
        'product.access',
        'inventory_receipts.access',
        'inventory_receipts.view',
    ]);
    $storeId = trim((string) ($_GET['areaId'] ?? $_GET['storeId'] ?? ''));
    field_inventory_require_store($user, $storeId);
    if (strtolower(trim((string) ($_GET['action'] ?? ''))) === 'next-code') {
        respond_ok(['suggestedCode' => ingredients_next_code('NCC', 'suppliers', 'supplier_code')]);
    }
    $search = trim((string) ($_GET['search'] ?? ''));
    $params = ['store_id' => $storeId];
    $sql = 'SELECT s.*,COUNT(i.id) ingredient_count
            FROM suppliers s
            LEFT JOIN ingredients i ON i.supplier_id COLLATE utf8mb4_unicode_ci=s.id COLLATE utf8mb4_unicode_ci
            WHERE s.store_id=:store_id';
    if ($search !== '') {
        $sql .= ' AND (s.supplier_code LIKE :needle OR s.supplier_name LIKE :needle
                       OR s.normalized_name LIKE :normalized OR s.phone LIKE :needle)';
        $params['needle'] = '%' . $search . '%';
        $params['normalized'] = '%' . ingredients_normalized_name($search) . '%';
    }
    $sql .= ' GROUP BY s.id ORDER BY s.supplier_name';
    $statement = db()->prepare($sql);
    $statement->execute($params);
    respond_ok(['items' => array_map('supplier_payload', $statement->fetchAll())]);
}

$body = read_json_body();
$user = auth_require_permission(['product.access', 'products.create', 'inventory_receipts.update']);
$storeId = trim((string) ($body['areaId'] ?? $body['storeId'] ?? $_GET['storeId'] ?? ''));
field_inventory_require_store($user, $storeId);

if ($method === 'POST') {
    $code = trim((string) ($body['supplierCode'] ?? ''));
    $name = trim((string) ($body['supplierName'] ?? ''));
    if ($code === '' || $name === '') respond_error('Vui lòng nhập mã và tên nhà phân phối.', 422);
    $id = uuidv4();
    try {
        $statement = db()->prepare(
            'INSERT INTO suppliers
             (id,store_id,supplier_code,supplier_name,normalized_name,contact_name,phone,email,address,tax_code,note,is_active)
             VALUES (:id,:store,:code,:name,:normalized,:contact,:phone,:email,:address,:tax_code,:note,:active)'
        );
        $statement->execute([
            'id' => $id, 'store' => $storeId, 'code' => $code, 'name' => $name,
            'normalized' => ingredients_normalized_name($name),
            'contact' => trim((string) ($body['contactName'] ?? '')) ?: null,
            'phone' => trim((string) ($body['phone'] ?? '')) ?: null,
            'email' => trim((string) ($body['email'] ?? '')) ?: null,
            'address' => trim((string) ($body['address'] ?? '')) ?: null,
            'tax_code' => trim((string) ($body['taxCode'] ?? '')) ?: null,
            'note' => trim((string) ($body['note'] ?? '')) ?: null,
            'active' => array_key_exists('isActive', $body) && !$body['isActive'] ? 0 : 1,
        ]);
    } catch (PDOException $exception) {
        if ((string) $exception->getCode() === '23000') respond_error('Mã nhà phân phối đã tồn tại.', 409);
        throw $exception;
    }
    respond_ok(['created' => true, 'id' => $id], 201);
}

$code = trim((string) ($body['supplierCode'] ?? $_GET['supplierCode'] ?? ''));
$find = db()->prepare('SELECT * FROM suppliers WHERE store_id=:store AND supplier_code=:code LIMIT 1');
$find->execute(['store' => $storeId, 'code' => $code]);
$existing = $find->fetch();
if (!$existing) respond_error('Không tìm thấy nhà phân phối.', 404);

if (in_array($method, ['PUT', 'PATCH'], true)) {
    $name = trim((string) ($body['supplierName'] ?? $existing['supplier_name']));
    $statement = db()->prepare(
        'UPDATE suppliers SET supplier_name=:name,normalized_name=:normalized,contact_name=:contact,
          phone=:phone,email=:email,address=:address,tax_code=:tax_code,note=:note,is_active=:active,updated_at=NOW()
         WHERE id=:id'
    );
    $statement->execute([
        'id' => $existing['id'], 'name' => $name, 'normalized' => ingredients_normalized_name($name),
        'contact' => trim((string) ($body['contactName'] ?? $existing['contact_name'])) ?: null,
        'phone' => trim((string) ($body['phone'] ?? $existing['phone'])) ?: null,
        'email' => trim((string) ($body['email'] ?? $existing['email'])) ?: null,
        'address' => trim((string) ($body['address'] ?? $existing['address'])) ?: null,
        'tax_code' => trim((string) ($body['taxCode'] ?? $existing['tax_code'])) ?: null,
        'note' => trim((string) ($body['note'] ?? $existing['note'])) ?: null,
        'active' => array_key_exists('isActive', $body) ? ($body['isActive'] ? 1 : 0) : (int) $existing['is_active'],
    ]);
    respond_ok(['updated' => true]);
}

if ($method === 'DELETE') {
    db()->prepare('UPDATE ingredients SET supplier_id=NULL WHERE supplier_id=:id')->execute(['id' => $existing['id']]);
    db()->prepare('DELETE FROM suppliers WHERE id=:id')->execute(['id' => $existing['id']]);
    respond_ok(['deleted' => true]);
}

respond_error('Method not allowed', 405);
