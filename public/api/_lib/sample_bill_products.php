<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
function sample_bill_products_ensure_schema(): void
{
    static $ensured = false;

    if ($ensured) {
        return;
    }

    db()->exec(
        'CREATE TABLE IF NOT EXISTS sample_bill_products (
            id VARCHAR(36) PRIMARY KEY,
            product_code VARCHAR(100) NOT NULL,
            product_name VARCHAR(255) NOT NULL,
            unit VARCHAR(50) NOT NULL DEFAULT "",
            price DECIMAL(15,2) NOT NULL DEFAULT 0,
            bill_type ENUM("coffee", "hotpot", "farm") NOT NULL,
            farm_schedule ENUM("none", "weekday", "weekend_holiday", "both") NOT NULL DEFAULT "none",
            min_quantity INT NOT NULL DEFAULT 1,
            max_quantity INT NOT NULL DEFAULT 1,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_sample_bill_product_code (product_code),
            KEY idx_sample_bill_products_type (bill_type),
            KEY idx_sample_bill_products_schedule (farm_schedule),
            KEY idx_sample_bill_products_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $ensured = true;
}

function sample_bill_product_payload(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'productCode' => (string) $row['product_code'],
        'productName' => (string) $row['product_name'],
        'unit' => (string) $row['unit'],
        'price' => (float) $row['price'],
        'billType' => (string) $row['bill_type'],
        'farmSchedule' => (string) $row['farm_schedule'],
        'minQuantity' => (int) $row['min_quantity'],
        'maxQuantity' => (int) $row['max_quantity'],
        'isActive' => (bool) $row['is_active'],
        'createdAt' => (string) $row['created_at'],
        'updatedAt' => (string) $row['updated_at'],
    ];
}
