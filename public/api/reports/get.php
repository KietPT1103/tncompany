<?php

declare(strict_types=1);

require __DIR__ . '/../_lib/bootstrap.php';
require_once __DIR__ . '/../_lib/auth.php';

require_admin();

$id = trim((string)($_GET['id'] ?? ''));
if ($id === '') {
    respond_error('Report id is required', 422);
}

$pdo = db();
$reportStmt = $pdo->prepare('SELECT * FROM reports WHERE id = :id LIMIT 1');
$reportStmt->execute(['id' => $id]);
$report = $reportStmt->fetch();

if (!$report) {
    respond_error('Report not found', 404);
}

$detailStmt = $pdo->prepare(
    'SELECT product_code, product_name, quantity, cost_unit, cost
     FROM report_details
     WHERE report_id = :report_id
     ORDER BY id ASC'
);
$detailStmt->execute(['report_id' => $id]);

$details = array_map(static function (array $row): array {
    return [
        'product_code' => $row['product_code'],
        'product_name' => $row['product_name'],
        'quantity' => (float)$row['quantity'],
        'costUnit' => (float)$row['cost_unit'],
        'cost' => (float)$row['cost'],
    ];
}, $detailStmt->fetchAll());

respond_ok([
    'report' => [
        'id' => $report['id'],
        'fileName' => $report['file_name'],
        'revenue' => (float)$report['revenue'],
        'salary' => (float)$report['salary'],
        'electric' => (float)$report['electric'],
        'other' => (float)$report['other'],
        'totalMaterialCost' => (float)$report['total_material_cost'],
        'totalCost' => (float)$report['total_cost'],
        'profit' => (float)$report['profit'],
        'includeInCashFlow' => (bool)$report['include_in_cash_flow'],
        'storeId' => $report['store_id'],
        'details' => $details,
        'createdAt' => ['seconds' => strtotime((string)$report['created_at'])],
    ],
]);
