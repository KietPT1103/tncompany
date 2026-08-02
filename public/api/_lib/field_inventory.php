<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/ingredients.php';

const FIELD_RECEIPT_STATUSES = ['pending_explanation', 'draft', 'completed', 'cancelled'];

function field_inventory_has_permission(array $user, string $permission): bool
{
    if (auth_has_permission($user, $permission)) {
        return true;
    }

    return auth_has_permission($user, 'inventory_receipts.access');
}

function field_inventory_require_permission(string $permission): array
{
    $user = auth_require();
    if (!field_inventory_has_permission($user, $permission)) {
        respond_error('Forbidden', 403);
    }
    return $user;
}

function field_inventory_can_access_store(array $user, string $storeId): bool
{
    if ($storeId === '') {
        return false;
    }
    if (($user['role'] ?? '') === 'admin') {
        return true;
    }
    if (($user['storeId'] ?? null) === $storeId) {
        return true;
    }

    $statement = db()->prepare(
        'SELECT 1 FROM user_store_access WHERE user_id = :user_id AND store_id = :store_id LIMIT 1'
    );
    $statement->execute(['user_id' => $user['id'], 'store_id' => $storeId]);
    return (bool) $statement->fetchColumn();
}

function field_inventory_require_store(array $user, string $storeId): string
{
    $normalized = trim($storeId);
    if (!field_inventory_can_access_store($user, $normalized)) {
        respond_error('Bạn không có quyền thao tác tại khu vực này.', 403);
    }
    return $normalized;
}

function field_inventory_allowed_stores(array $user): array
{
    if (($user['role'] ?? '') === 'admin') {
        $statement = db()->query(
            "SELECT id, name FROM stores WHERE id IN ('cafe','restaurant','farm','warehouse') ORDER BY FIELD(id,'cafe','restaurant','farm','warehouse')"
        );
    } else {
        $statement = db()->prepare(
            "SELECT DISTINCT s.id, s.name
             FROM stores s
             LEFT JOIN user_store_access usa ON usa.store_id = s.id AND usa.user_id = :user_id
             WHERE s.id IN ('cafe','restaurant','farm','warehouse')
               AND (s.id = :primary_store OR usa.user_id IS NOT NULL)
             ORDER BY FIELD(s.id,'cafe','restaurant','farm','warehouse')"
        );
        $statement->execute([
            'user_id' => $user['id'],
            'primary_store' => $user['storeId'] ?? '',
        ]);
    }

    return array_map(static fn(array $row): array => [
        'id' => (string) $row['id'],
        'code' => strtoupper((string) $row['id']),
        'name' => (string) $row['name'],
    ], $statement->fetchAll());
}

function field_inventory_datetime($value, bool $required = false): ?string
{
    $raw = trim((string) $value);
    if ($raw === '') {
        if ($required) {
            respond_error('Thiếu thời gian chụp.', 422);
        }
        return null;
    }
    try {
        return (new DateTimeImmutable($raw))->format('Y-m-d H:i:s');
    } catch (Throwable $exception) {
        respond_error('Thời gian không hợp lệ.', 422);
    }
}

function field_inventory_nullable_decimal($value): ?float
{
    return $value === null || $value === '' ? null : (is_numeric($value) ? (float) $value : null);
}

function field_inventory_load_receipt(string $id, bool $lock = false): ?array
{
    $statement = db()->prepare(
        'SELECT r.*, s.name AS area_name,supplier.supplier_code,supplier.supplier_name,
                COALESCE(u.display_name, u.username, u.email, r.created_by) AS creator_name
         FROM inventory_receipts r
         INNER JOIN stores s ON s.id = r.store_id
         LEFT JOIN suppliers supplier
           ON supplier.id COLLATE utf8mb4_unicode_ci=r.supplier_id COLLATE utf8mb4_unicode_ci
         LEFT JOIN users u ON u.id COLLATE utf8mb4_unicode_ci = r.created_by
         WHERE r.id = :id LIMIT 1' . ($lock ? ' FOR UPDATE' : '')
    );
    $statement->execute(['id' => $id]);
    $row = $statement->fetch();
    return $row ?: null;
}

function field_inventory_require_receipt(array $user, string $id, bool $lock = false): array
{
    $receipt = field_inventory_load_receipt($id, $lock);
    if (!$receipt) {
        respond_error('Không tìm thấy phiếu nhập.', 404);
    }
    field_inventory_require_store($user, (string) $receipt['store_id']);
    return $receipt;
}

function field_inventory_receipt_payload(array $row, array $items = [], array $images = []): array
{
    return [
        'id' => (string) $row['id'],
        'receiptCode' => (string) $row['receipt_code'],
        'clientRequestId' => $row['client_request_id'] ?: null,
        'areaId' => (string) $row['store_id'],
        'storeId' => (string) $row['store_id'],
        'area' => ['id' => (string) $row['store_id'], 'name' => (string) ($row['area_name'] ?? '')],
        'supplierId' => $row['supplier_id'] ?: null,
        'supplier' => $row['supplier_id'] ? [
            'id' => (string) $row['supplier_id'],
            'supplierCode' => (string) ($row['supplier_code'] ?? ''),
            'supplierName' => (string) ($row['supplier_name'] ?? ''),
        ] : null,
        'orderCreatorName' => trim((string) ($row['order_creator_name'] ?? '')),
        'status' => (string) $row['status'],
        'receiptDate' => (string) $row['receipt_date'],
        'receivedAt' => $row['received_at'] ?: null,
        'capturedAt' => $row['captured_at'] ?: null,
        'location' => [
            'latitude' => field_inventory_nullable_decimal($row['latitude']),
            'longitude' => field_inventory_nullable_decimal($row['longitude']),
            'accuracy' => field_inventory_nullable_decimal($row['location_accuracy']),
            'address' => $row['location_address'] ?: null,
        ],
        'note' => $row['note'] ?: '',
        'totalQuantity' => (float) $row['total_quantity'],
        'totalAmount' => (float) $row['total_amount'],
        'createdBy' => (string) $row['created_by'],
        'createdByName' => (string) ($row['creator_name'] ?? $row['created_by']),
        'completedAt' => $row['completed_at'] ?: null,
        'cancelledAt' => $row['cancelled_at'] ?: null,
        'cancelReason' => $row['cancel_reason'] ?: null,
        'createdAt' => (string) $row['created_at'],
        'updatedAt' => (string) $row['updated_at'],
        'itemCount' => count($items),
        'imageCount' => count($images),
        'items' => $items,
        'images' => $images,
    ];
}

function field_inventory_load_items(string $receiptId): array
{
    $statement = db()->prepare(
        'SELECT i.*, ingredient.unit AS current_unit
         FROM inventory_receipt_items i
         LEFT JOIN ingredients ingredient
           ON ingredient.id COLLATE utf8mb4_unicode_ci=i.ingredient_id COLLATE utf8mb4_unicode_ci
         WHERE i.receipt_id = :receipt_id ORDER BY i.id'
    );
    $statement->execute(['receipt_id' => $receiptId]);
    return array_map(static fn(array $row): array => [
        'id' => (int) $row['id'],
        'productId' => (string) ($row['ingredient_id'] ?: $row['product_id']),
        'ingredientId' => (string) ($row['ingredient_id'] ?: $row['product_id']),
        'productCode' => (string) $row['product_code'],
        'productName' => (string) $row['product_name'],
        'unit' => $row['unit'] ?: ($row['current_unit'] ?: ''),
        'quantity' => (float) $row['quantity'],
        'unitPrice' => (float) $row['unit_cost'],
        'unitCost' => (float) $row['unit_cost'],
        'lineTotal' => (float) $row['line_total'],
        'note' => $row['note'] ?: '',
    ], $statement->fetchAll());
}

function field_inventory_load_images(string $receiptId): array
{
    $statement = db()->prepare(
        'SELECT id, receipt_item_id, client_file_id, mime_type, file_size, width, height,
                captured_at, latitude, longitude, location_accuracy, location_address, uploaded_by, created_at
         FROM inventory_receipt_images WHERE receipt_id = :receipt_id ORDER BY created_at'
    );
    $statement->execute(['receipt_id' => $receiptId]);
    return array_map(static fn(array $row): array => [
        'id' => (string) $row['id'],
        'receiptItemId' => $row['receipt_item_id'] !== null ? (int) $row['receipt_item_id'] : null,
        'clientFileId' => (string) $row['client_file_id'],
        'mimeType' => (string) $row['mime_type'],
        'fileSize' => (int) $row['file_size'],
        'width' => $row['width'] !== null ? (int) $row['width'] : null,
        'height' => $row['height'] !== null ? (int) $row['height'] : null,
        'capturedAt' => (string) $row['captured_at'],
        'locationAddress' => $row['location_address'] ?: null,
        'url' => '/api/inventory-receipt-images.php?id=' . rawurlencode((string) $row['id']),
        'thumbnailUrl' => '/api/inventory-receipt-images.php?id=' . rawurlencode((string) $row['id']) . '&size=thumbnail',
    ], $statement->fetchAll());
}
