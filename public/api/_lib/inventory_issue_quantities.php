<?php

declare(strict_types=1);

function inventory_issue_parse_quantity(mixed $value): float
{
    return round((float) str_replace(',', '.', trim((string) $value)), 6);
}

function inventory_issue_base_quantity(float $quantity, float $conversionFactor): float
{
    return round($quantity * max(0.000001, $conversionFactor), 3);
}

function inventory_issue_format_quantity(float $quantity): string
{
    return rtrim(rtrim(number_format($quantity, 6, '.', ''), '0'), '.');
}

function inventory_issue_ensure_quantity_precision(PDO $pdo): void
{
    $lockName = 'tn_company_inventory_issue_quantity_v2';
    $lock = $pdo->prepare('SELECT GET_LOCK(:name, 10)');
    $lock->execute(['name' => $lockName]);
    if ((int) $lock->fetchColumn() !== 1) {
        throw new RuntimeException('Không thể cập nhật độ chính xác số lượng xuất kho.');
    }

    try {
        $columns = [
            ['inventory_issues', 'total_quantity', 6, 'ALTER TABLE inventory_issues MODIFY COLUMN total_quantity DECIMAL(18,6) NOT NULL DEFAULT 0'],
            ['inventory_issue_items', 'quantity', 6, 'ALTER TABLE inventory_issue_items MODIFY COLUMN quantity DECIMAL(18,6) NOT NULL'],
        ];
        $lookup = $pdo->prepare('SELECT NUMERIC_SCALE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=:table_name AND COLUMN_NAME=:column_name LIMIT 1');
        foreach ($columns as [$table, $column, $requiredScale, $alterSql]) {
            $lookup->execute(['table_name' => $table, 'column_name' => $column]);
            $scale = $lookup->fetchColumn();
            $lookup->closeCursor();
            if ($scale !== false && (int) $scale < $requiredScale) {
                $pdo->exec($alterSql);
            }
        }
    } finally {
        $release = $pdo->prepare('SELECT RELEASE_LOCK(:name)');
        $release->execute(['name' => $lockName]);
    }
}
