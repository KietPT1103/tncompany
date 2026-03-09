<?php

declare(strict_types=1);

require __DIR__ . '/../_lib/bootstrap.php';
require_once __DIR__ . '/../_lib/auth.php';

require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respond_error('Method not allowed', 405);
}

$body = read_json_body();
$id = trim((string)($body['id'] ?? ''));

if ($id === '') {
    respond_error('Report id is required', 422);
}

$mapping = [
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

$fields = [];
$params = ['id' => $id];

foreach ($mapping as $input => $column) {
    if (!array_key_exists($input, $body)) {
        continue;
    }

    $fields[] = $column . ' = :' . $input;
    $params[$input] = $input === 'includeInCashFlow' ? (!empty($body[$input]) ? 1 : 0) : $body[$input];
}

if (!$fields) {
    respond_ok(['updated' => false]);
}

$stmt = db()->prepare(
    'UPDATE reports SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = :id'
);
$stmt->execute($params);

respond_ok(['updated' => true]);
