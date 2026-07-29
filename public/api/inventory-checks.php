<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/products_inventory.php';

function inventory_checks_normalize_date(?string $rawValue): string
{
    $value = trim((string) $rawValue);
    if ($value === '') {
        return (new DateTimeImmutable('today'))->format('Y-m-d');
    }

    $date = DateTimeImmutable::createFromFormat('Y-m-d', $value);
    if ($date === false) {
        respond_error('Ngay kiem kho khong hop le.', 422);
    }

    return $date->format('Y-m-d');
}

function inventory_checks_normalize_status(?string $rawValue): string
{
    $value = strtolower(trim((string) $rawValue));
    return $value === 'completed' ? 'completed' : 'draft';
}

function inventory_checks_actor_name(array $user): string
{
    return trim((string) ($user['displayName'] ?? $user['username'] ?? $user['email'] ?? '')) ?: 'admin';
}

function inventory_checks_normalize_items(string $storeId, array $items, bool $requireCounted): array
{
    $normalizedByProductId = [];

    foreach ($items as $item) {
        $productCode = trim((string) ($item['productCode'] ?? ''));
        if ($productCode === '') {
            continue;
        }

        $product = ingredients_find($storeId, $productCode);
        if (!$product) {
            respond_error(sprintf('Khong tim thay nguyen lieu %s.', $productCode), 422);
        }

        $actualExists = array_key_exists('actualQuantity', $item) || array_key_exists('actual_quantity', $item);
        $actualRaw = $item['actualQuantity'] ?? $item['actual_quantity'] ?? null;
        $isCounted = $actualExists && trim((string) $actualRaw) !== '';

        if ($requireCounted && !$isCounted) {
            respond_error(
                sprintf('Hang hoa %s chua nhap so thuc te, khong the hoan thanh phieu.', $productCode),
                422
            );
        }

        $actualQuantity = 0.0;
        $varianceQuantity = 0.0;
        $varianceValue = 0.0;
        $systemQuantity = $product['stock_quantity'] !== null ? (float) $product['stock_quantity'] : 0.0;
        $unitCost = $product['cost'] !== null ? (float) $product['cost'] : 0.0;
        $note = trim((string) ($item['note'] ?? ''));

        if ($isCounted) {
            $actualQuantity = products_inventory_parse_decimal($actualRaw);
            if ($actualQuantity < 0) {
                respond_error(sprintf('So thuc te cua %s khong duoc am.', $productCode), 422);
            }

            $varianceQuantity = round($actualQuantity - $systemQuantity, 3);
            $varianceValue = round($varianceQuantity * $unitCost, 2);
        }

        $productId = (string) $product['id'];
        $normalizedByProductId[$productId] = [
            'productId' => $productId,
            'productCode' => (string) $product['ingredient_code'],
            'productName' => (string) $product['ingredient_name'],
            'systemQuantity' => round($systemQuantity, 3),
            'isCounted' => $isCounted,
            'actualQuantity' => round($actualQuantity, 3),
            'varianceQuantity' => $isCounted ? $varianceQuantity : 0.0,
            'unitCost' => round($unitCost, 2),
            'varianceValue' => $isCounted ? $varianceValue : 0.0,
            'note' => $note,
        ];
    }

    $normalized = array_values($normalizedByProductId);
    if ($normalized === []) {
        respond_error('Phieu kiem kho phai co it nhat 1 hang hoa hop le.', 422);
    }

    return $normalized;
}

function inventory_checks_build_totals(array $items): array
{
    return array_reduce(
        $items,
        static function (array $carry, array $item): array {
            if (!$item['isCounted']) {
                return $carry;
            }

            $variance = (float) $item['varianceQuantity'];
            $carry['countedItemCount'] += 1;
            $carry['totalActualQuantity'] += (float) $item['actualQuantity'];
            $carry['totalVarianceQuantity'] += $variance;
            $carry['increaseQuantityTotal'] += $variance > 0 ? $variance : 0.0;
            $carry['decreaseQuantityTotal'] += $variance < 0 ? abs($variance) : 0.0;
            $carry['varianceValueTotal'] += (float) $item['varianceValue'];
            return $carry;
        },
        [
            'countedItemCount' => 0,
            'totalActualQuantity' => 0.0,
            'totalVarianceQuantity' => 0.0,
            'increaseQuantityTotal' => 0.0,
            'decreaseQuantityTotal' => 0.0,
            'varianceValueTotal' => 0.0,
        ]
    );
}

function inventory_checks_insert_items(string $checkId, array $items): void
{
    $statement = db()->prepare(
        'INSERT INTO inventory_check_items (
            check_id, product_id, ingredient_id, product_code, product_name, system_quantity, is_counted,
            actual_quantity, variance_quantity, unit_cost, variance_value, note
         ) VALUES (
            :check_id, NULL, :ingredient_id, :product_code, :product_name, :system_quantity, :is_counted,
            :actual_quantity, :variance_quantity, :unit_cost, :variance_value, :note
         )'
    );

    foreach ($items as $item) {
        $statement->execute([
            'check_id' => $checkId,
            'ingredient_id' => $item['productId'],
            'product_code' => $item['productCode'],
            'product_name' => $item['productName'],
            'system_quantity' => $item['systemQuantity'],
            'is_counted' => $item['isCounted'] ? 1 : 0,
            'actual_quantity' => $item['actualQuantity'],
            'variance_quantity' => $item['varianceQuantity'],
            'unit_cost' => $item['unitCost'],
            'variance_value' => $item['varianceValue'],
            'note' => $item['note'],
        ]);
    }
}

function inventory_checks_load_one(string $checkId): ?array
{
    $checkStatement = db()->prepare(
        'SELECT *
         FROM inventory_checks
         WHERE id = :id
         LIMIT 1'
    );
    $checkStatement->execute(['id' => $checkId]);
    $check = $checkStatement->fetch();

    if (!$check) {
        return null;
    }

    $itemsStatement = db()->prepare(
        'SELECT id, product_id, ingredient_id, product_code, product_name, system_quantity, is_counted,
                actual_quantity, variance_quantity, unit_cost, variance_value, note
         FROM inventory_check_items
         WHERE check_id = :check_id
         ORDER BY id ASC'
    );
    $itemsStatement->execute(['check_id' => $checkId]);
    $items = array_map(
        static function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'productId' => (string) ($row['ingredient_id'] ?: $row['product_id']),
                'productCode' => (string) $row['product_code'],
                'productName' => (string) $row['product_name'],
                'systemQuantity' => (float) $row['system_quantity'],
                'isCounted' => (bool) $row['is_counted'],
                'actualQuantity' => (bool) $row['is_counted'] ? (float) $row['actual_quantity'] : null,
                'varianceQuantity' => (bool) $row['is_counted'] ? (float) $row['variance_quantity'] : null,
                'unitCost' => (float) $row['unit_cost'],
                'varianceValue' => (bool) $row['is_counted'] ? (float) $row['variance_value'] : null,
                'note' => $row['note'] !== null ? (string) $row['note'] : '',
            ];
        },
        $itemsStatement->fetchAll()
    );

    return [
        'id' => (string) $check['id'],
        'storeId' => (string) $check['store_id'],
        'checkCode' => (string) $check['check_code'],
        'checkDate' => (string) $check['check_date'],
        'status' => (string) $check['status'],
        'note' => $check['note'] !== null ? (string) $check['note'] : '',
        'countedItemCount' => (int) $check['counted_item_count'],
        'totalActualQuantity' => (float) $check['total_actual_quantity'],
        'totalVarianceQuantity' => (float) $check['total_variance_quantity'],
        'increaseQuantityTotal' => (float) $check['increase_quantity_total'],
        'decreaseQuantityTotal' => (float) $check['decrease_quantity_total'],
        'varianceValueTotal' => (float) $check['variance_value_total'],
        'createdBy' => $check['created_by'] !== null ? (string) $check['created_by'] : '',
        'completedBy' => $check['completed_by'] !== null ? (string) $check['completed_by'] : '',
        'completedAt' => $check['completed_at'] !== null ? (string) $check['completed_at'] : null,
        'createdAt' => (string) $check['created_at'],
        'updatedAt' => (string) $check['updated_at'],
        'items' => $items,
    ];
}

products_inventory_ensure_schema();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    auth_require_permission('inventory_checks.access');

    $storeId = trim((string) ($_GET['storeId'] ?? 'cafe'));
    $status = strtolower(trim((string) ($_GET['status'] ?? '')));
    $search = trim((string) ($_GET['search'] ?? ''));
    $limit = max(1, min(200, (int) ($_GET['limit'] ?? 50)));

    $where = ['c.store_id = :store_id'];
    $params = [
        'store_id' => $storeId,
        'limit' => $limit,
    ];

    if (in_array($status, ['draft', 'completed', 'cancelled'], true)) {
        $where[] = 'c.status = :status';
        $params['status'] = $status;
    }

    if ($search !== '') {
        $where[] = '(c.check_code LIKE :search OR c.note LIKE :search OR EXISTS (
            SELECT 1
            FROM inventory_check_items ici
            WHERE ici.check_id = c.id
              AND (ici.product_code LIKE :search OR ici.product_name LIKE :search)
        ))';
        $params['search'] = '%' . $search . '%';
    }

    $statement = db()->prepare(
        sprintf(
            'SELECT c.*
             FROM inventory_checks c
             WHERE %s
             ORDER BY c.check_date DESC, c.created_at DESC
             LIMIT :limit',
            implode(' AND ', $where)
        )
    );
    foreach ($params as $key => $value) {
        $statement->bindValue(':' . $key, $value, $key === 'limit' ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $statement->execute();

    $checkRows = $statement->fetchAll();
    $checkIds = array_values(
        array_map(
            static function (array $row): string {
                return (string) $row['id'];
            },
            $checkRows
        )
    );

    $itemsByCheck = [];
    if ($checkIds !== []) {
        $placeholders = implode(', ', array_fill(0, count($checkIds), '?'));
        $itemsStatement = db()->prepare(
            sprintf(
                'SELECT id, check_id, product_id, ingredient_id, product_code, product_name, system_quantity, is_counted,
                        actual_quantity, variance_quantity, unit_cost, variance_value, note
                 FROM inventory_check_items
                 WHERE check_id IN (%s)
                 ORDER BY id ASC',
                $placeholders
            )
        );
        $itemsStatement->execute($checkIds);

        foreach ($itemsStatement->fetchAll() as $row) {
            $checkId = (string) $row['check_id'];
            $isCounted = (bool) $row['is_counted'];

            $itemsByCheck[$checkId][] = [
                'id' => (int) $row['id'],
                'productId' => (string) ($row['ingredient_id'] ?: $row['product_id']),
                'productCode' => (string) $row['product_code'],
                'productName' => (string) $row['product_name'],
                'systemQuantity' => (float) $row['system_quantity'],
                'isCounted' => $isCounted,
                'actualQuantity' => $isCounted ? (float) $row['actual_quantity'] : null,
                'varianceQuantity' => $isCounted ? (float) $row['variance_quantity'] : null,
                'unitCost' => (float) $row['unit_cost'],
                'varianceValue' => $isCounted ? (float) $row['variance_value'] : null,
                'note' => $row['note'] !== null ? (string) $row['note'] : '',
            ];
        }
    }

    $items = array_map(
        static function (array $row) use ($itemsByCheck): array {
            $checkId = (string) $row['id'];

            return [
                'id' => $checkId,
                'storeId' => (string) $row['store_id'],
                'checkCode' => (string) $row['check_code'],
                'checkDate' => (string) $row['check_date'],
                'status' => (string) $row['status'],
                'note' => $row['note'] !== null ? (string) $row['note'] : '',
                'countedItemCount' => (int) $row['counted_item_count'],
                'totalActualQuantity' => (float) $row['total_actual_quantity'],
                'totalVarianceQuantity' => (float) $row['total_variance_quantity'],
                'increaseQuantityTotal' => (float) $row['increase_quantity_total'],
                'decreaseQuantityTotal' => (float) $row['decrease_quantity_total'],
                'varianceValueTotal' => (float) $row['variance_value_total'],
                'createdBy' => $row['created_by'] !== null ? (string) $row['created_by'] : '',
                'completedBy' => $row['completed_by'] !== null ? (string) $row['completed_by'] : '',
                'completedAt' => $row['completed_at'] !== null ? (string) $row['completed_at'] : null,
                'createdAt' => (string) $row['created_at'],
                'updatedAt' => (string) $row['updated_at'],
                'items' => $itemsByCheck[$checkId] ?? [],
            ];
        },
        $checkRows
    );

    respond_ok(['items' => $items]);
}

if ($method === 'POST') {
    $user = auth_require_permission('inventory_checks.access');
    $body = read_json_body();
    $storeId = trim((string) ($body['storeId'] ?? 'cafe'));
    $status = inventory_checks_normalize_status((string) ($body['status'] ?? 'draft'));
    $checkDate = inventory_checks_normalize_date((string) ($body['checkDate'] ?? ''));
    $note = trim((string) ($body['note'] ?? ''));
    $items = inventory_checks_normalize_items(
        $storeId,
        is_array($body['items'] ?? null) ? $body['items'] : [],
        $status === 'completed'
    );
    $totals = inventory_checks_build_totals($items);
    $actor = inventory_checks_actor_name($user);
    $checkId = trim((string) ($body['id'] ?? ''));

    db()->beginTransaction();

    try {
        if ($checkId !== '') {
            $findStatement = db()->prepare(
                'SELECT id, status
                 FROM inventory_checks
                 WHERE id = :id
                   AND store_id = :store_id
                 LIMIT 1
                 FOR UPDATE'
            );
            $findStatement->execute([
                'id' => $checkId,
                'store_id' => $storeId,
            ]);
            $existingCheck = $findStatement->fetch();

            if (!$existingCheck) {
                respond_error('Khong tim thay phieu kiem kho.', 404);
            }

            if ((string) $existingCheck['status'] === 'completed') {
                respond_error('Phieu da hoan thanh khong the chinh sua.', 422);
            }

            $updateCheck = db()->prepare(
                'UPDATE inventory_checks
                 SET check_date = :check_date,
                     status = :status,
                     note = :note,
                     counted_item_count = :counted_item_count,
                     total_actual_quantity = :total_actual_quantity,
                     total_variance_quantity = :total_variance_quantity,
                     increase_quantity_total = :increase_quantity_total,
                     decrease_quantity_total = :decrease_quantity_total,
                     variance_value_total = :variance_value_total,
                     completed_at = :completed_at,
                     completed_by = :completed_by,
                     updated_at = NOW()
                 WHERE id = :id'
            );
            $updateCheck->execute([
                'id' => $checkId,
                'check_date' => $checkDate,
                'status' => $status,
                'note' => $note,
                'counted_item_count' => $totals['countedItemCount'],
                'total_actual_quantity' => round((float) $totals['totalActualQuantity'], 3),
                'total_variance_quantity' => round((float) $totals['totalVarianceQuantity'], 3),
                'increase_quantity_total' => round((float) $totals['increaseQuantityTotal'], 3),
                'decrease_quantity_total' => round((float) $totals['decreaseQuantityTotal'], 3),
                'variance_value_total' => round((float) $totals['varianceValueTotal'], 2),
                'completed_at' => $status === 'completed' ? (new DateTimeImmutable())->format('Y-m-d H:i:s') : null,
                'completed_by' => $status === 'completed' ? $actor : null,
            ]);

            $deleteItems = db()->prepare('DELETE FROM inventory_check_items WHERE check_id = :check_id');
            $deleteItems->execute(['check_id' => $checkId]);
            inventory_checks_insert_items($checkId, $items);
        } else {
            $checkId = uuidv4();
            $insertCheck = db()->prepare(
                'INSERT INTO inventory_checks (
                    id, store_id, check_code, check_date, status, note,
                    counted_item_count, total_actual_quantity, total_variance_quantity,
                    increase_quantity_total, decrease_quantity_total, variance_value_total,
                    completed_at, completed_by, created_by
                 ) VALUES (
                    :id, :store_id, :check_code, :check_date, :status, :note,
                    :counted_item_count, :total_actual_quantity, :total_variance_quantity,
                    :increase_quantity_total, :decrease_quantity_total, :variance_value_total,
                    :completed_at, :completed_by, :created_by
                 )'
            );
            $insertCheck->execute([
                'id' => $checkId,
                'store_id' => $storeId,
                'check_code' => products_inventory_generate_check_code($storeId),
                'check_date' => $checkDate,
                'status' => $status,
                'note' => $note,
                'counted_item_count' => $totals['countedItemCount'],
                'total_actual_quantity' => round((float) $totals['totalActualQuantity'], 3),
                'total_variance_quantity' => round((float) $totals['totalVarianceQuantity'], 3),
                'increase_quantity_total' => round((float) $totals['increaseQuantityTotal'], 3),
                'decrease_quantity_total' => round((float) $totals['decreaseQuantityTotal'], 3),
                'variance_value_total' => round((float) $totals['varianceValueTotal'], 2),
                'completed_at' => $status === 'completed' ? (new DateTimeImmutable())->format('Y-m-d H:i:s') : null,
                'completed_by' => $status === 'completed' ? $actor : null,
                'created_by' => $actor,
            ]);
            inventory_checks_insert_items($checkId, $items);
        }

        if ($status === 'completed') {
            products_inventory_apply_check($checkId);
        }

        db()->commit();
    } catch (Throwable $exception) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }

        throw $exception;
    }

    $item = inventory_checks_load_one($checkId);
    respond_ok(['item' => $item], $body['id'] ? 200 : 201);
}

if ($method === 'DELETE') {
    auth_require_permission('inventory_checks.access');
    $body = read_json_body();
    $checkId = trim((string) ($body['id'] ?? ''));

    if ($checkId === '') {
        respond_error('Thieu ma phieu kiem kho.', 422);
    }

    $statement = db()->prepare(
        'DELETE FROM inventory_checks
         WHERE id = :id
           AND status = "draft"'
    );
    $statement->execute(['id' => $checkId]);

    if ($statement->rowCount() === 0) {
        respond_error('Chi co the xoa phieu tam.', 422);
    }

    respond_ok(['deleted' => true]);
}

respond_error('Not found', 404);
