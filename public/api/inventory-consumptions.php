<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/products_inventory.php';
require_once __DIR__ . '/_lib/field_inventory.php';

function inventory_consumptions_actor_name(array $user): string
{
    return trim((string) ($user['displayName'] ?? $user['username'] ?? $user['email'] ?? '')) ?: 'admin';
}

function inventory_consumptions_normalize_date(?string $rawValue): ?string
{
    $value = trim((string) $rawValue);
    if ($value === '') {
        return null;
    }

    $date = DateTimeImmutable::createFromFormat('Y-m-d', $value);
    if ($date === false) {
        respond_error('Ngày báo cáo không hợp lệ.', 422);
    }

    return $date->format('Y-m-d');
}

products_inventory_ensure_schema();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $user = auth_require_permission('dashboard.access');

    $storeId = field_inventory_require_store($user, trim((string) ($_GET['storeId'] ?? '')));
    if ($storeId === 'warehouse') respond_error('Kho thợ không sử dụng tiêu hao theo công thức bán hàng.', 422);
    $limit = max(1, min(50, (int) ($_GET['limit'] ?? 10)));

    respond_ok([
        'items' => products_inventory_list_consumptions($storeId, $limit),
    ]);
}

if ($method === 'POST') {
    $user = auth_require_permission('dashboard.access');
    $body = read_json_body();
    $storeId = field_inventory_require_store($user, trim((string) ($body['storeId'] ?? '')));
    if ($storeId === 'warehouse') respond_error('Kho thợ không sử dụng tiêu hao theo công thức bán hàng.', 422);
    $fileName = trim((string) ($body['fileName'] ?? 'Báo cáo bán hàng'));
    $salesItems = is_array($body['salesItems'] ?? null) ? $body['salesItems'] : [];
    $startDate = inventory_consumptions_normalize_date($body['startDate'] ?? null);
    $endDate = inventory_consumptions_normalize_date($body['endDate'] ?? null);
    $note = trim((string) ($body['note'] ?? ''));
    $dryRun = !empty($body['dryRun']);

    if ($salesItems === []) {
        respond_error('Không có dữ liệu bán hàng để xử lý.', 422);
    }

    if ($dryRun) {
        try {
            respond_ok([
                'preview' => products_inventory_resolve_consumption_preview($storeId, $salesItems),
            ]);
        } catch (RuntimeException $exception) {
            respond_error($exception->getMessage(), 422);
        }
    }

    try {
        $item = products_inventory_apply_sales_consumption(
            $storeId,
            $fileName,
            $startDate,
            $endDate,
            $salesItems,
            inventory_consumptions_actor_name($user),
            $note
        );
    } catch (RuntimeException $exception) {
        respond_error($exception->getMessage(), 422);
    }

    respond_ok([
        'item' => $item,
    ], 201);
}

respond_error('Not found', 404);
