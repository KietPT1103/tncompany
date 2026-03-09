<?php

declare(strict_types=1);

require __DIR__ . '/../_lib/bootstrap.php';
require_once __DIR__ . '/../_lib/auth.php';

require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respond_error('Method not allowed', 405);
}

$body = read_json_body();
$id = uuidv4();
$storeId = trim((string)($body['storeId'] ?? 'cafe'));
$fileName = trim((string)($body['fileName'] ?? ''));
$details = $body['details'] ?? [];

if ($fileName === '') {
    respond_error('fileName is required', 422);
}

$pdo = db();
$pdo->beginTransaction();

try {
    $reportStmt = $pdo->prepare(
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
    $reportStmt->execute([
        'id' => $id,
        'store_id' => $storeId,
        'file_name' => $fileName,
        'revenue' => $body['revenue'] ?? 0,
        'salary' => $body['salary'] ?? 0,
        'electric' => $body['electric'] ?? 0,
        'other' => $body['other'] ?? 0,
        'total_material_cost' => $body['totalMaterialCost'] ?? 0,
        'total_cost' => $body['totalCost'] ?? 0,
        'profit' => $body['profit'] ?? 0,
        'include_in_cash_flow' => !empty($body['includeInCashFlow']) ? 1 : 0,
        'report_start_date' => !empty($body['startDate']) ? date('Y-m-d H:i:s', strtotime((string)$body['startDate'])) : null,
        'report_end_date' => !empty($body['endDate']) ? date('Y-m-d H:i:s', strtotime((string)$body['endDate'])) : null,
        'created_at' => !empty($body['createdAt']) ? date('Y-m-d H:i:s', strtotime((string)$body['createdAt'])) : date('Y-m-d H:i:s'),
    ]);

    if (is_array($details)) {
        $detailStmt = $pdo->prepare(
            'INSERT INTO report_details (report_id, product_code, product_name, quantity, cost_unit, cost)
             VALUES (:report_id, :product_code, :product_name, :quantity, :cost_unit, :cost)'
        );

        foreach ($details as $detail) {
            if (!is_array($detail)) {
                continue;
            }

            $detailStmt->execute([
                'report_id' => $id,
                'product_code' => (string)($detail['product_code'] ?? ''),
                'product_name' => (string)($detail['product_name'] ?? ''),
                'quantity' => $detail['quantity'] ?? 0,
                'cost_unit' => $detail['costUnit'] ?? 0,
                'cost' => $detail['cost'] ?? 0,
            ]);
        }
    }

    $pdo->commit();
} catch (Throwable $exception) {
    $pdo->rollBack();
    respond_error('Failed to create report', 500, [
        'details' => $exception->getMessage(),
    ]);
}

respond_ok(['id' => $id], 201);
