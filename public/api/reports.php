<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';

function reports_map_details(string $reportId): array
{
    $statement = db()->prepare(
        'SELECT product_code, product_name, quantity, cost_unit, cost
         FROM report_details
         WHERE report_id = :report_id
         ORDER BY id ASC'
    );
    $statement->execute([
        'report_id' => $reportId,
    ]);

    return array_map(
        static fn(array $row): array => [
            'product_code' => (string) $row['product_code'],
            'product_name' => (string) $row['product_name'],
            'quantity' => (float) $row['quantity'],
            'costUnit' => (float) $row['cost_unit'],
            'cost' => (float) $row['cost'],
        ],
        $statement->fetchAll()
    );
}

function reports_map_row(array $row, bool $includeDetails = false): array
{
    return [
        'id' => (string) $row['id'],
        'storeId' => (string) $row['store_id'],
        'fileName' => (string) $row['file_name'],
        'revenue' => (float) $row['revenue'],
        'salary' => (float) $row['salary'],
        'electric' => (float) $row['electric'],
        'other' => (float) $row['other'],
        'totalMaterialCost' => (float) $row['total_material_cost'],
        'totalCost' => (float) $row['total_cost'],
        'profit' => (float) $row['profit'],
        'includeInCashFlow' => (bool) $row['include_in_cash_flow'],
        'createdAt' => $row['created_at'],
        'startDate' => $row['report_start_date'],
        'endDate' => $row['report_end_date'],
        'details' => $includeDetails ? reports_map_details((string) $row['id']) : [],
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    auth_require(['admin']);

    $id = trim((string) ($_GET['id'] ?? ''));
    if ($id !== '') {
        $statement = db()->prepare('SELECT * FROM reports WHERE id = :id LIMIT 1');
        $statement->execute([
            'id' => $id,
        ]);
        $row = $statement->fetch();
        if (!$row) {
            respond_ok([
                'item' => null,
            ]);
        }

        respond_ok([
            'item' => reports_map_row($row, true),
        ]);
    }

    $storeId = trim((string) ($_GET['storeId'] ?? 'cafe'));
    $limit = max(1, min(1000, (int) ($_GET['limit'] ?? 20)));
    $startDate = trim((string) ($_GET['startDate'] ?? ''));
    $endDate = trim((string) ($_GET['endDate'] ?? ''));

    $sql = 'SELECT * FROM reports WHERE store_id = :store_id';
    $params = ['store_id' => $storeId];

    if ($startDate !== '') {
        $sql .= ' AND created_at >= :start_date';
        $params['start_date'] = $startDate;
    }

    if ($endDate !== '') {
        $sql .= ' AND created_at <= :end_date';
        $params['end_date'] = $endDate;
    }

    $sql .= ' ORDER BY created_at DESC LIMIT ' . $limit;
    $statement = db()->prepare($sql);
    $statement->execute($params);

    respond_ok([
        'items' => array_map(
            static fn(array $row): array => reports_map_row($row, false),
            $statement->fetchAll()
        ),
    ]);
}

if ($method === 'POST') {
    auth_require(['admin']);

    $body = read_json_body();
    $details = is_array($body['details'] ?? null) ? $body['details'] : [];
    $id = uuidv4();

    $statement = db()->prepare(
        'INSERT INTO reports (
            id, store_id, file_name, revenue, salary, electric, other,
            total_material_cost, total_cost, profit, include_in_cash_flow,
            report_start_date, report_end_date, created_at
         ) VALUES (
            :id, :store_id, :file_name, :revenue, :salary, :electric, :other,
            :total_material_cost, :total_cost, :profit, :include_in_cash_flow,
            :report_start_date, :report_end_date, :created_at
         )'
    );
    $statement->execute([
        'id' => $id,
        'store_id' => trim((string) ($body['storeId'] ?? 'cafe')),
        'file_name' => trim((string) ($body['fileName'] ?? 'Untitled report')),
        'revenue' => (float) ($body['revenue'] ?? 0),
        'salary' => (float) ($body['salary'] ?? 0),
        'electric' => (float) ($body['electric'] ?? 0),
        'other' => (float) ($body['other'] ?? 0),
        'total_material_cost' => (float) ($body['totalMaterialCost'] ?? 0),
        'total_cost' => (float) ($body['totalCost'] ?? 0),
        'profit' => (float) ($body['profit'] ?? 0),
        'include_in_cash_flow' => array_key_exists('includeInCashFlow', $body) && !$body['includeInCashFlow'] ? 0 : 1,
        'report_start_date' => $body['startDate'] ?: null,
        'report_end_date' => $body['endDate'] ?: null,
        'created_at' => $body['createdAt'] ?: (new DateTimeImmutable())->format('Y-m-d H:i:s'),
    ]);

    if ($details !== []) {
        $detailStatement = db()->prepare(
            'INSERT INTO report_details (report_id, product_code, product_name, quantity, cost_unit, cost)
             VALUES (:report_id, :product_code, :product_name, :quantity, :cost_unit, :cost)'
        );

        foreach ($details as $detail) {
            $detailStatement->execute([
                'report_id' => $id,
                'product_code' => (string) ($detail['product_code'] ?? ''),
                'product_name' => (string) ($detail['product_name'] ?? ''),
                'quantity' => (float) ($detail['quantity'] ?? 0),
                'cost_unit' => (float) ($detail['costUnit'] ?? 0),
                'cost' => (float) ($detail['cost'] ?? 0),
            ]);
        }
    }

    respond_ok([
        'id' => $id,
    ], 201);
}

if ($method === 'PATCH') {
    auth_require(['admin']);

    $body = read_json_body();
    $id = trim((string) ($body['id'] ?? ''));
    if ($id === '') {
        respond_error('Report id is required', 422);
    }

    $fields = [];
    $params = ['id' => $id];
    $fieldMap = [
        'fileName' => 'file_name',
        'revenue' => 'revenue',
        'salary' => 'salary',
        'electric' => 'electric',
        'other' => 'other',
        'totalMaterialCost' => 'total_material_cost',
        'totalCost' => 'total_cost',
        'profit' => 'profit',
        'includeInCashFlow' => 'include_in_cash_flow',
    ];

    foreach ($fieldMap as $payloadKey => $column) {
        if (!array_key_exists($payloadKey, $body)) {
            continue;
        }

        $fields[] = sprintf('%s = :%s', $column, $payloadKey);
        if ($payloadKey === 'includeInCashFlow') {
            $params[$payloadKey] = !empty($body[$payloadKey]) ? 1 : 0;
        } else {
            $params[$payloadKey] = $body[$payloadKey];
        }
    }

    if ($fields === []) {
        respond_error('No changes provided', 422);
    }

    $statement = db()->prepare(
        sprintf('UPDATE reports SET %s WHERE id = :id', implode(', ', $fields))
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
        respond_error('Report id is required', 422);
    }

    $statement = db()->prepare('DELETE FROM reports WHERE id = :id');
    $statement->execute([
        'id' => $id,
    ]);

    respond_ok([
        'deleted' => true,
    ]);
}

respond_error('Not found', 404);
