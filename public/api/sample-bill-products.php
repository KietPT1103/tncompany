<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/sample_bill_products.php';

auth_require(['admin']);
sample_bill_products_ensure_schema();

function sample_bill_product_normalize(array $raw): array
{
    $productCode = trim((string) ($raw['productCode'] ?? ''));
    $productName = trim((string) ($raw['productName'] ?? ''));
    $unit = trim((string) ($raw['unit'] ?? ''));
    $price = round((float) ($raw['price'] ?? 0), 2);
    $billType = trim((string) ($raw['billType'] ?? ''));
    $farmSchedule = trim((string) ($raw['farmSchedule'] ?? 'none'));
    $minQuantity = max(1, (int) ($raw['minQuantity'] ?? 1));
    $maxQuantity = max($minQuantity, (int) ($raw['maxQuantity'] ?? $minQuantity));
    $isActive = !array_key_exists('isActive', $raw) || !empty($raw['isActive']);

    if ($productCode === '' || $productName === '') {
        respond_error('Mã và tên sản phẩm là bắt buộc.', 422);
    }
    if (!in_array($billType, ['coffee', 'hotpot', 'farm'], true)) {
        respond_error('Loại bill không hợp lệ.', 422);
    }
    if ($price < 0) {
        respond_error('Đơn giá không được âm.', 422);
    }
    if ($billType !== 'farm') {
        $farmSchedule = 'none';
    } elseif (!in_array($farmSchedule, ['weekday', 'weekend_holiday', 'both'], true)) {
        respond_error('Lịch giá Farm không hợp lệ.', 422);
    }

    return [
        'product_code' => $productCode,
        'product_name' => $productName,
        'unit' => $unit,
        'price' => $price,
        'bill_type' => $billType,
        'farm_schedule' => $farmSchedule,
        'min_quantity' => $minQuantity,
        'max_quantity' => $maxQuantity,
        'is_active' => $isActive ? 1 : 0,
    ];
}

function sample_bill_product_merge_schedule(string $current, string $incoming): string
{
    if ($current === $incoming || $current === 'both' || $incoming === 'both') {
        return $current === 'both' || $incoming === 'both' ? 'both' : $current;
    }

    if (
        in_array($current, ['weekday', 'weekend_holiday'], true) &&
        in_array($incoming, ['weekday', 'weekend_holiday'], true)
    ) {
        return 'both';
    }

    return $incoming;
}

function sample_bill_product_upsert(
    array $item,
    ?array $resolvedExisting = null,
    bool $existingResolved = false
): string
{
    $existing = $resolvedExisting;
    if (!$existingResolved) {
        $find = db()->prepare(
            'SELECT * FROM sample_bill_products WHERE product_code = :product_code LIMIT 1'
        );
        $find->execute(['product_code' => $item['product_code']]);
        $existing = $find->fetch() ?: null;
    }

    if (!$existing) {
        $insert = db()->prepare(
            'INSERT INTO sample_bill_products (
                id, product_code, product_name, unit, price, bill_type,
                farm_schedule, min_quantity, max_quantity, is_active
             ) VALUES (
                :id, :product_code, :product_name, :unit, :price, :bill_type,
                :farm_schedule, :min_quantity, :max_quantity, :is_active
             )'
        );
        $insert->execute(array_merge(['id' => uuidv4()], $item));
        return 'created';
    }

    $schedule = $item['farm_schedule'];
    if (
        $existing['bill_type'] === 'farm' &&
        $item['bill_type'] === 'farm' &&
        $existing['farm_schedule'] !== $schedule
    ) {
        if ((float) $existing['price'] !== (float) $item['price']) {
            respond_error(
                sprintf(
                    'Mã %s xuất hiện ở hai lịch giá với đơn giá khác nhau.',
                    $item['product_code']
                ),
                409
            );
        }
        $schedule = sample_bill_product_merge_schedule(
            (string) $existing['farm_schedule'],
            $schedule
        );
    }

    $update = db()->prepare(
        'UPDATE sample_bill_products
         SET product_name = :product_name,
             unit = :unit,
             price = :price,
             bill_type = :bill_type,
             farm_schedule = :farm_schedule,
             min_quantity = :min_quantity,
             max_quantity = :max_quantity,
             is_active = :is_active,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = :id'
    );
    $update->execute([
        'id' => $existing['id'],
        'product_name' => $item['product_name'],
        'unit' => $item['unit'],
        'price' => $item['price'],
        'bill_type' => $item['bill_type'],
        'farm_schedule' => $schedule,
        'min_quantity' => $item['min_quantity'],
        'max_quantity' => $item['max_quantity'],
        'is_active' => $item['is_active'],
    ]);

    return 'updated';
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $billType = trim((string) ($_GET['billType'] ?? ''));
    $params = [];
    $where = [];

    if ($billType !== '') {
        if (!in_array($billType, ['coffee', 'hotpot', 'farm'], true)) {
            respond_error('Loại bill không hợp lệ.', 422);
        }
        $where[] = 'bill_type = :bill_type';
        $params['bill_type'] = $billType;
    }

    $sql = 'SELECT * FROM sample_bill_products';
    if ($where !== []) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY bill_type ASC, product_name ASC, product_code ASC';

    $statement = db()->prepare($sql);
    $statement->execute($params);
    $items = array_map('sample_bill_product_payload', $statement->fetchAll());

    respond_ok(['items' => $items]);
}

if ($method === 'POST') {
    $body = read_json_body();

    if (($body['action'] ?? '') === 'import') {
        @set_time_limit(120);
        $rawItems = is_array($body['items'] ?? null) ? $body['items'] : [];
        if ($rawItems === []) {
            respond_error('Danh sách import đang trống.', 422);
        }

        $seen = [];
        $normalizedItems = [];
        foreach ($rawItems as $rawItem) {
            $code = strtolower(trim((string) ($rawItem['productCode'] ?? '')));
            if ($code === '' || isset($seen[$code])) {
                respond_error('File có mã sản phẩm trống hoặc bị trùng.', 422);
            }
            $seen[$code] = true;
            $normalizedItems[] = sample_bill_product_normalize((array) $rawItem);
        }

        $codes = array_column($normalizedItems, 'product_code');
        $placeholders = implode(', ', array_fill(0, count($codes), '?'));
        $existingStatement = db()->prepare(
            'SELECT * FROM sample_bill_products WHERE product_code IN (' . $placeholders . ')'
        );
        $existingStatement->execute($codes);
        $existingByCode = [];
        foreach ($existingStatement->fetchAll() as $existingItem) {
            $existingByCode[strtolower((string) $existingItem['product_code'])] = $existingItem;
        }

        $created = 0;
        $updated = 0;
        db()->beginTransaction();
        try {
            foreach ($normalizedItems as $item) {
                $lookupCode = strtolower((string) $item['product_code']);
                $result = sample_bill_product_upsert(
                    $item,
                    $existingByCode[$lookupCode] ?? null,
                    true
                );
                $result === 'created' ? $created++ : $updated++;
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
            'created' => $created,
            'updated' => $updated,
        ]);
    }

    $item = sample_bill_product_normalize($body);
    $check = db()->prepare(
        'SELECT id FROM sample_bill_products WHERE product_code = :product_code LIMIT 1'
    );
    $check->execute(['product_code' => $item['product_code']]);
    if ($check->fetch()) {
        respond_error('Mã sản phẩm đã tồn tại.', 409);
    }

    sample_bill_product_upsert($item);
    respond_ok(['created' => true], 201);
}

if ($method === 'PATCH') {
    $body = read_json_body();
    $id = trim((string) ($body['id'] ?? ''));
    if ($id === '') {
        respond_error('Thiếu id sản phẩm.', 422);
    }

    $find = db()->prepare('SELECT * FROM sample_bill_products WHERE id = :id LIMIT 1');
    $find->execute(['id' => $id]);
    $existing = $find->fetch();
    if (!$existing) {
        respond_error('Không tìm thấy sản phẩm.', 404);
    }

    $item = sample_bill_product_normalize([
        'productCode' => $body['productCode'] ?? $existing['product_code'],
        'productName' => $body['productName'] ?? $existing['product_name'],
        'unit' => $body['unit'] ?? $existing['unit'],
        'price' => $body['price'] ?? $existing['price'],
        'billType' => $body['billType'] ?? $existing['bill_type'],
        'farmSchedule' => $body['farmSchedule'] ?? $existing['farm_schedule'],
        'minQuantity' => $body['minQuantity'] ?? $existing['min_quantity'],
        'maxQuantity' => $body['maxQuantity'] ?? $existing['max_quantity'],
        'isActive' => $body['isActive'] ?? (bool) $existing['is_active'],
    ]);

    $duplicate = db()->prepare(
        'SELECT id FROM sample_bill_products
         WHERE product_code = :product_code AND id <> :id
         LIMIT 1'
    );
    $duplicate->execute([
        'product_code' => $item['product_code'],
        'id' => $id,
    ]);
    if ($duplicate->fetch()) {
        respond_error('Mã sản phẩm đã tồn tại.', 409);
    }

    $update = db()->prepare(
        'UPDATE sample_bill_products
         SET product_code = :product_code,
             product_name = :product_name,
             unit = :unit,
             price = :price,
             bill_type = :bill_type,
             farm_schedule = :farm_schedule,
             min_quantity = :min_quantity,
             max_quantity = :max_quantity,
             is_active = :is_active,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = :id'
    );
    $update->execute(array_merge(['id' => $id], $item));

    respond_ok(['updated' => true]);
}

if ($method === 'DELETE') {
    $id = trim((string) ($_GET['id'] ?? ''));
    if ($id === '') {
        respond_error('Thiếu id sản phẩm.', 422);
    }

    $statement = db()->prepare('DELETE FROM sample_bill_products WHERE id = :id');
    $statement->execute(['id' => $id]);
    if ($statement->rowCount() === 0) {
        respond_error('Không tìm thấy sản phẩm.', 404);
    }

    respond_ok(['deleted' => true]);
}

respond_error('Not found', 404);
