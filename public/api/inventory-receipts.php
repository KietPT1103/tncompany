<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/products_inventory.php';

function inventory_receipts_normalize_date(?string $rawValue): string
{
    $value = trim((string) $rawValue);
    if ($value === '') {
        return (new DateTimeImmutable('today'))->format('Y-m-d');
    }

    $date = DateTimeImmutable::createFromFormat('Y-m-d', $value);
    if ($date === false) {
        respond_error('Ngày nhập không hợp lệ.', 422);
    }

    return $date->format('Y-m-d');
}

function inventory_receipts_normalize_status(?string $rawValue): string
{
    $value = strtolower(trim((string) $rawValue));
    return $value === 'completed' ? 'completed' : 'draft';
}

function inventory_receipts_actor_name(array $user): string
{
    return trim((string) ($user['displayName'] ?? $user['username'] ?? $user['email'] ?? '')) ?: 'admin';
}

function inventory_receipts_normalize_items(string $storeId, array $items): array
{
    $normalized = [];

    foreach ($items as $item) {
        $productCode = trim((string) ($item['productCode'] ?? ''));
        $quantity = products_inventory_parse_decimal($item['quantity'] ?? null);
        $unitCost = products_inventory_parse_decimal($item['unitCost'] ?? null, 2);
        $note = trim((string) ($item['note'] ?? ''));

        if ($productCode === '' || $quantity <= 0 || $unitCost <= 0) {
            continue;
        }

        $product = products_inventory_find_product($storeId, $productCode);
        if (!$product) {
            respond_error(sprintf('Không tìm thấy hàng hoá %s.', $productCode), 422);
        }

        $normalized[] = [
            'productId' => (string) $product['id'],
            'productCode' => (string) $product['product_code'],
            'productName' => (string) $product['product_name'],
            'quantity' => $quantity,
            'unitCost' => $unitCost,
            'lineTotal' => round($quantity * $unitCost, 2),
            'note' => $note,
        ];
    }

    if ($normalized === []) {
        respond_error('Phiếu nhập phải có ít nhất 1 hàng hoá hợp lệ.', 422);
    }

    return $normalized;
}

function inventory_receipts_insert_items(string $receiptId, array $items): void
{
    $statement = db()->prepare(
        'INSERT INTO inventory_receipt_items (
            receipt_id, product_id, product_code, product_name, quantity, unit_cost, line_total, note
         ) VALUES (
            :receipt_id, :product_id, :product_code, :product_name, :quantity, :unit_cost, :line_total, :note
         )'
    );

    foreach ($items as $item) {
        $statement->execute([
            'receipt_id' => $receiptId,
            'product_id' => $item['productId'],
            'product_code' => $item['productCode'],
            'product_name' => $item['productName'],
            'quantity' => $item['quantity'],
            'unit_cost' => $item['unitCost'],
            'line_total' => $item['lineTotal'],
            'note' => $item['note'],
        ]);
    }
}

function inventory_receipts_load_one(string $receiptId): ?array
{
    $receiptStatement = db()->prepare(
        'SELECT *
         FROM inventory_receipts
         WHERE id = :id
         LIMIT 1'
    );
    $receiptStatement->execute(['id' => $receiptId]);
    $receipt = $receiptStatement->fetch();

    if (!$receipt) {
        return null;
    }

    $itemsStatement = db()->prepare(
        'SELECT id, product_id, product_code, product_name, quantity, unit_cost, line_total, note
         FROM inventory_receipt_items
         WHERE receipt_id = :receipt_id
         ORDER BY id ASC'
    );
    $itemsStatement->execute(['receipt_id' => $receiptId]);
    $items = array_map(
        static function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'productId' => (string) $row['product_id'],
                'productCode' => (string) $row['product_code'],
                'productName' => (string) $row['product_name'],
                'quantity' => (float) $row['quantity'],
                'unitCost' => (float) $row['unit_cost'],
                'lineTotal' => (float) $row['line_total'],
                'note' => $row['note'] !== null ? (string) $row['note'] : '',
            ];
        },
        $itemsStatement->fetchAll()
    );

    return [
        'id' => (string) $receipt['id'],
        'storeId' => (string) $receipt['store_id'],
        'receiptCode' => (string) $receipt['receipt_code'],
        'receiptDate' => (string) $receipt['receipt_date'],
        'status' => (string) $receipt['status'],
        'note' => $receipt['note'] !== null ? (string) $receipt['note'] : '',
        'totalAmount' => (float) $receipt['total_amount'],
        'createdBy' => $receipt['created_by'] !== null ? (string) $receipt['created_by'] : '',
        'completedBy' => $receipt['completed_by'] !== null ? (string) $receipt['completed_by'] : '',
        'completedAt' => $receipt['completed_at'] !== null ? (string) $receipt['completed_at'] : null,
        'createdAt' => (string) $receipt['created_at'],
        'updatedAt' => (string) $receipt['updated_at'],
        'items' => $items,
    ];
}

products_inventory_ensure_schema();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    auth_require_permission('inventory_receipts.access');

    $storeId = trim((string) ($_GET['storeId'] ?? 'cafe'));
    $status = strtolower(trim((string) ($_GET['status'] ?? '')));
    $search = trim((string) ($_GET['search'] ?? ''));
    $limit = max(1, min(200, (int) ($_GET['limit'] ?? 50)));

    $where = ['r.store_id = :store_id'];
    $params = [
        'store_id' => $storeId,
        'limit' => $limit,
    ];

    if (in_array($status, ['draft', 'completed'], true)) {
        $where[] = 'r.status = :status';
        $params['status'] = $status;
    }

    if ($search !== '') {
        $where[] = '(r.receipt_code LIKE :search OR r.note LIKE :search OR EXISTS (
            SELECT 1
            FROM inventory_receipt_items iri
            WHERE iri.receipt_id = r.id
              AND (iri.product_code LIKE :search OR iri.product_name LIKE :search)
        ))';
        $params['search'] = '%' . $search . '%';
    }

    $statement = db()->prepare(
        sprintf(
            'SELECT r.*
             FROM inventory_receipts r
             WHERE %s
             ORDER BY r.receipt_date DESC, r.created_at DESC
             LIMIT :limit',
            implode(' AND ', $where)
        )
    );
    foreach ($params as $key => $value) {
        $type = $key === 'limit' ? PDO::PARAM_INT : PDO::PARAM_STR;
        $statement->bindValue(':' . $key, $value, $type);
    }
    $statement->execute();

    $receiptRows = $statement->fetchAll();
    $receiptIds = array_values(
        array_map(
            static function (array $row): string {
                return (string) $row['id'];
            },
            $receiptRows
        )
    );

    $itemsByReceipt = [];
    if ($receiptIds !== []) {
        $placeholders = implode(', ', array_fill(0, count($receiptIds), '?'));
        $itemsStatement = db()->prepare(
            sprintf(
                'SELECT id, receipt_id, product_id, product_code, product_name, quantity, unit_cost, line_total, note
                 FROM inventory_receipt_items
                 WHERE receipt_id IN (%s)
                 ORDER BY id ASC',
                $placeholders
            )
        );
        $itemsStatement->execute($receiptIds);

        foreach ($itemsStatement->fetchAll() as $row) {
            $receiptId = (string) $row['receipt_id'];
            $itemsByReceipt[$receiptId][] = [
                'id' => (int) $row['id'],
                'productId' => (string) $row['product_id'],
                'productCode' => (string) $row['product_code'],
                'productName' => (string) $row['product_name'],
                'quantity' => (float) $row['quantity'],
                'unitCost' => (float) $row['unit_cost'],
                'lineTotal' => (float) $row['line_total'],
                'note' => $row['note'] !== null ? (string) $row['note'] : '',
            ];
        }
    }

    $items = array_map(
        static function (array $row) use ($itemsByReceipt): array {
            $receiptId = (string) $row['id'];

            return [
                'id' => $receiptId,
                'storeId' => (string) $row['store_id'],
                'receiptCode' => (string) $row['receipt_code'],
                'receiptDate' => (string) $row['receipt_date'],
                'status' => (string) $row['status'],
                'note' => $row['note'] !== null ? (string) $row['note'] : '',
                'totalAmount' => (float) $row['total_amount'],
                'createdBy' => $row['created_by'] !== null ? (string) $row['created_by'] : '',
                'completedBy' => $row['completed_by'] !== null ? (string) $row['completed_by'] : '',
                'completedAt' => $row['completed_at'] !== null ? (string) $row['completed_at'] : null,
                'createdAt' => (string) $row['created_at'],
                'updatedAt' => (string) $row['updated_at'],
                'items' => $itemsByReceipt[$receiptId] ?? [],
            ];
        },
        $receiptRows
    );

    respond_ok(['items' => $items]);
}

if ($method === 'POST') {
    $user = auth_require_permission('inventory_receipts.access');
    $body = read_json_body();
    $storeId = trim((string) ($body['storeId'] ?? 'cafe'));
    $status = inventory_receipts_normalize_status((string) ($body['status'] ?? 'draft'));
    $receiptDate = inventory_receipts_normalize_date((string) ($body['receiptDate'] ?? ''));
    $note = trim((string) ($body['note'] ?? ''));
    $items = inventory_receipts_normalize_items(
        $storeId,
        is_array($body['items'] ?? null) ? $body['items'] : []
    );
    $totalAmount = round(
        array_reduce(
            $items,
            static function (float $sum, array $item): float {
                return $sum + (float) $item['lineTotal'];
            },
            0.0
        ),
        2
    );
    $actor = inventory_receipts_actor_name($user);
    $receiptId = trim((string) ($body['id'] ?? ''));

    db()->beginTransaction();

    try {
        if ($receiptId !== '') {
            $findStatement = db()->prepare(
                'SELECT id, status
                 FROM inventory_receipts
                 WHERE id = :id
                   AND store_id = :store_id
                 LIMIT 1
                 FOR UPDATE'
            );
            $findStatement->execute([
                'id' => $receiptId,
                'store_id' => $storeId,
            ]);
            $existingReceipt = $findStatement->fetch();

            if (!$existingReceipt) {
                respond_error('Không tìm thấy phiếu nhập.', 404);
            }

            if ((string) $existingReceipt['status'] === 'completed') {
                respond_error('Phiếu đã hoàn thành không thể chỉnh sửa.', 422);
            }

            $updateReceipt = db()->prepare(
                'UPDATE inventory_receipts
                 SET receipt_date = :receipt_date,
                     status = :status,
                     note = :note,
                     total_amount = :total_amount,
                     completed_at = :completed_at,
                     completed_by = :completed_by,
                     updated_at = NOW()
                 WHERE id = :id'
            );
            $updateReceipt->execute([
                'id' => $receiptId,
                'receipt_date' => $receiptDate,
                'status' => $status,
                'note' => $note,
                'total_amount' => $totalAmount,
                'completed_at' => $status === 'completed' ? (new DateTimeImmutable())->format('Y-m-d H:i:s') : null,
                'completed_by' => $status === 'completed' ? $actor : null,
            ]);

            $deleteItems = db()->prepare('DELETE FROM inventory_receipt_items WHERE receipt_id = :receipt_id');
            $deleteItems->execute(['receipt_id' => $receiptId]);
            inventory_receipts_insert_items($receiptId, $items);
        } else {
            $receiptId = uuidv4();
            $insertReceipt = db()->prepare(
                'INSERT INTO inventory_receipts (
                    id, store_id, receipt_code, receipt_date, status, note, total_amount,
                    completed_at, completed_by, created_by
                 ) VALUES (
                    :id, :store_id, :receipt_code, :receipt_date, :status, :note, :total_amount,
                    :completed_at, :completed_by, :created_by
                 )'
            );
            $insertReceipt->execute([
                'id' => $receiptId,
                'store_id' => $storeId,
                'receipt_code' => products_inventory_generate_receipt_code($storeId),
                'receipt_date' => $receiptDate,
                'status' => $status,
                'note' => $note,
                'total_amount' => $totalAmount,
                'completed_at' => $status === 'completed' ? (new DateTimeImmutable())->format('Y-m-d H:i:s') : null,
                'completed_by' => $status === 'completed' ? $actor : null,
                'created_by' => $actor,
            ]);
            inventory_receipts_insert_items($receiptId, $items);
        }

        if ($status === 'completed') {
            products_inventory_apply_receipt($receiptId);
        }

        db()->commit();
    } catch (Throwable $exception) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }

        throw $exception;
    }

    $item = inventory_receipts_load_one($receiptId);
    respond_ok(['item' => $item], $body['id'] ? 200 : 201);
}

if ($method === 'DELETE') {
    auth_require_permission('inventory_receipts.access');
    $body = read_json_body();
    $receiptId = trim((string) ($body['id'] ?? ''));

    if ($receiptId === '') {
        respond_error('Thiếu mã phiếu nhập.', 422);
    }

    $statement = db()->prepare(
        'DELETE FROM inventory_receipts
         WHERE id = :id
           AND status = "draft"'
    );
    $statement->execute(['id' => $receiptId]);

    if ($statement->rowCount() === 0) {
        respond_error('Chỉ có thể xoá phiếu tạm.', 422);
    }

    respond_ok(['deleted' => true]);
}

respond_error('Not found', 404);
