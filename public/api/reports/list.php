<?php

declare(strict_types=1);

require __DIR__ . '/../_lib/bootstrap.php';
require_once __DIR__ . '/../_lib/auth.php';

require_admin();

$storeId = trim((string)($_GET['storeId'] ?? 'cafe'));
$limit = max(1, min(1000, (int)($_GET['limit'] ?? 50)));
$startDate = trim((string)($_GET['startDate'] ?? ''));
$endDate = trim((string)($_GET['endDate'] ?? ''));

$sql = 'SELECT *
        FROM reports
        WHERE store_id = :store_id';
$params = ['store_id' => $storeId];

if ($startDate !== '') {
    $sql .= ' AND created_at >= :start_date';
    $params['start_date'] = $startDate . ' 00:00:00';
}
if ($endDate !== '') {
    $sql .= ' AND created_at <= :end_date';
    $params['end_date'] = $endDate . ' 23:59:59';
}

$sql .= ' ORDER BY created_at DESC LIMIT ' . $limit;

$stmt = db()->prepare($sql);
$stmt->execute($params);

$rows = array_map(static function (array $row): array {
    return [
        'id' => $row['id'],
        'fileName' => $row['file_name'],
        'revenue' => (float)$row['revenue'],
        'salary' => (float)$row['salary'],
        'electric' => (float)$row['electric'],
        'other' => (float)$row['other'],
        'totalMaterialCost' => (float)$row['total_material_cost'],
        'totalCost' => (float)$row['total_cost'],
        'profit' => (float)$row['profit'],
        'includeInCashFlow' => (bool)$row['include_in_cash_flow'],
        'storeId' => $row['store_id'],
        'createdAt' => [
            'seconds' => strtotime((string)$row['created_at']),
        ],
        'startDate' => $row['report_start_date'] ? ['seconds' => strtotime((string)$row['report_start_date'])] : null,
        'endDate' => $row['report_end_date'] ? ['seconds' => strtotime((string)$row['report_end_date'])] : null,
    ];
}, $stmt->fetchAll());

respond_ok(['items' => $rows]);
