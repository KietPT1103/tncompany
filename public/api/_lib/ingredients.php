<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';

function ingredients_normalized_name(string $value): string
{
    $normalized = trim(preg_replace('/\s+/u', ' ', mb_strtolower($value, 'UTF-8')) ?? '');
    if (class_exists('Transliterator')) {
        $transliterator = Transliterator::create('NFD; [:Nonspacing Mark:] Remove; NFC; Latin-ASCII');
        if ($transliterator) {
            return (string) $transliterator->transliterate($normalized);
        }
    }
    if (function_exists('iconv')) {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', str_replace(['đ', 'Đ'], ['d', 'D'], $normalized));
        if ($ascii !== false) {
            return $ascii;
        }
    }
    return $normalized;
}

function ingredients_exec_with_deadlock_retry(string $sql, int $attempts = 3): void
{
    for ($attempt = 1; $attempt <= $attempts; $attempt++) {
        try {
            db()->exec($sql);
            return;
        } catch (PDOException $exception) {
            $driverCode = (int) ($exception->errorInfo[1] ?? 0);
            if (!in_array($driverCode, [1205, 1213], true) || $attempt === $attempts) {
                throw $exception;
            }
            usleep(random_int(80000, 220000) * $attempt);
        }
    }
}

function ingredients_ensure_schema(): void
{
    static $ensured = false;
    if ($ensured) {
        return;
    }

    db()->exec(
        'CREATE TABLE IF NOT EXISTS app_schema_migrations (
            migration_key VARCHAR(100) PRIMARY KEY,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $migrationKey = 'ingredients_suppliers_v2';
    $migrationCheck = db()->prepare(
        'SELECT 1 FROM app_schema_migrations WHERE migration_key=:migration_key LIMIT 1'
    );
    $migrationCheck->execute(['migration_key' => $migrationKey]);
    if ($migrationCheck->fetchColumn()) {
        $ensured = true;
        return;
    }

    $lockStatement = db()->prepare('SELECT GET_LOCK(:lock_name, 10)');
    $lockStatement->execute(['lock_name' => 'tn_company_ingredients_schema_v2']);
    if ((int) $lockStatement->fetchColumn() !== 1) {
        throw new RuntimeException('Hệ thống đang cập nhật dữ liệu nguyên liệu. Vui lòng thử lại sau vài giây.');
    }

    try {
        $migrationCheck->execute(['migration_key' => $migrationKey]);
        if ($migrationCheck->fetchColumn()) {
            $ensured = true;
            return;
        }

    db()->exec(
        'CREATE TABLE IF NOT EXISTS suppliers (
            id VARCHAR(64) PRIMARY KEY,
            store_id VARCHAR(32) NOT NULL,
            supplier_code VARCHAR(100) NOT NULL,
            supplier_name VARCHAR(255) NOT NULL,
            normalized_name VARCHAR(255) NULL,
            contact_name VARCHAR(255) NULL,
            phone VARCHAR(50) NULL,
            email VARCHAR(255) NULL,
            address VARCHAR(500) NULL,
            tax_code VARCHAR(100) NULL,
            note TEXT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_suppliers_store_code (store_id, supplier_code),
            KEY idx_suppliers_store_name (store_id, supplier_name),
            KEY idx_suppliers_active (store_id, is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    db()->exec(
        'CREATE TABLE IF NOT EXISTS ingredients (
            id VARCHAR(64) PRIMARY KEY,
            store_id VARCHAR(32) NOT NULL,
            ingredient_code VARCHAR(100) NOT NULL,
            ingredient_name VARCHAR(255) NOT NULL,
            normalized_name VARCHAR(255) NULL,
            unit VARCHAR(50) NULL,
            cost DECIMAL(15,2) NULL,
            stock_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
            supplier_id VARCHAR(64) NULL,
            supplier_item_code VARCHAR(100) NULL,
            description TEXT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            legacy_product_id VARCHAR(64) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_ingredients_store_code (store_id, ingredient_code),
            KEY idx_ingredients_store_name (store_id, ingredient_name),
            KEY idx_ingredients_supplier (supplier_id),
            KEY idx_ingredients_legacy_product (legacy_product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    db()->exec(
        'CREATE TABLE IF NOT EXISTS product_ingredients (
            id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
            store_id VARCHAR(32) NOT NULL,
            product_id VARCHAR(64) NOT NULL,
            ingredient_id VARCHAR(64) NOT NULL,
            quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_product_ingredient (product_id, ingredient_id),
            KEY idx_product_ingredients_store (store_id),
            KEY idx_product_ingredients_product (product_id),
            KEY idx_product_ingredients_ingredient (ingredient_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $existingTables = db()->query(
        'SELECT table_name FROM information_schema.tables
         WHERE table_schema=DATABASE() AND table_name IN
           ("inventory_receipts","inventory_receipt_items","inventory_check_items",
            "inventory_consumption_items","inventory_stock_movements")'
    )->fetchAll(PDO::FETCH_COLUMN);
    if (in_array('inventory_receipts', $existingTables, true)) {
        auth_ensure_column('inventory_receipts', 'supplier_id', 'VARCHAR(64) NULL AFTER store_id');
    }
    foreach ([
        'inventory_receipt_items',
        'inventory_check_items',
        'inventory_consumption_items',
        'inventory_stock_movements',
    ] as $inventoryTable) {
        if (!in_array($inventoryTable, $existingTables, true)) {
            continue;
        }
        $foreignKeys = db()->prepare(
            'SELECT constraint_name
             FROM information_schema.key_column_usage
             WHERE table_schema=DATABASE() AND table_name=:table_name
               AND column_name="product_id" AND referenced_table_name IS NOT NULL'
        );
        $foreignKeys->execute(['table_name' => $inventoryTable]);
        foreach ($foreignKeys->fetchAll(PDO::FETCH_COLUMN) as $foreignKey) {
            if (preg_match('/^[A-Za-z0-9_]+$/', (string) $foreignKey)) {
                db()->exec(sprintf('ALTER TABLE `%s` DROP FOREIGN KEY `%s`', $inventoryTable, $foreignKey));
            }
        }
        $nullable = db()->prepare(
            'SELECT is_nullable FROM information_schema.columns
             WHERE table_schema=DATABASE() AND table_name=:table_name AND column_name="product_id" LIMIT 1'
        );
        $nullable->execute(['table_name' => $inventoryTable]);
        if (strtoupper((string) $nullable->fetchColumn()) !== 'YES') {
            db()->exec(sprintf('ALTER TABLE `%s` MODIFY product_id VARCHAR(64) NULL', $inventoryTable));
        }
        auth_ensure_column($inventoryTable, 'ingredient_id', 'VARCHAR(64) NULL AFTER product_id');
        ingredients_exec_with_deadlock_retry(
            sprintf(
                'UPDATE `%s` target
                 INNER JOIN ingredients i
                   ON i.legacy_product_id COLLATE utf8mb4_unicode_ci =
                      target.product_id COLLATE utf8mb4_unicode_ci
                 SET target.ingredient_id=i.id
                 WHERE target.ingredient_id IS NULL',
                $inventoryTable
            )
        );
    }

    // Idempotent bridge for data classified by the earlier item_type implementation.
    $column = db()->prepare(
        'SELECT 1 FROM information_schema.columns
         WHERE table_schema=DATABASE() AND table_name="products" AND column_name="item_type" LIMIT 1'
    );
    $column->execute();
    if ($column->fetchColumn()) {
        ingredients_exec_with_deadlock_retry(
            'INSERT IGNORE INTO ingredients (
                id,store_id,ingredient_code,ingredient_name,normalized_name,unit,cost,stock_quantity,
                description,is_active,legacy_product_id,created_at,updated_at
             )
             SELECT UUID(),p.store_id,p.product_code,p.product_name,p.normalized_name,p.unit,p.cost,
                    p.stock_quantity,p.description,p.is_selling,p.id,p.created_at,p.updated_at
             FROM products p
             LEFT JOIN categories c
               ON c.id COLLATE utf8mb4_unicode_ci=p.category_id COLLATE utf8mb4_unicode_ci
             WHERE p.item_type="ingredient"
                OR LOWER(TRIM(COALESCE(c.name,""))) IN ("nguyên liệu","nguyen lieu")'
        );
        ingredients_exec_with_deadlock_retry(
            'UPDATE products p
             INNER JOIN ingredients i
               ON i.legacy_product_id COLLATE utf8mb4_unicode_ci=p.id COLLATE utf8mb4_unicode_ci
             SET p.item_type="ingredient"
             WHERE p.item_type<>"ingredient"'
        );
    }

    // Preserve recipes created before ingredients became an independent entity.
    $componentsTable = db()->prepare(
        'SELECT 1 FROM information_schema.tables
         WHERE table_schema=DATABASE() AND table_name="product_components" LIMIT 1'
    );
    $componentsTable->execute();
    if ($componentsTable->fetchColumn()) {
        ingredients_exec_with_deadlock_retry(
            'INSERT IGNORE INTO product_ingredients (store_id,product_id,ingredient_id,quantity,created_at,updated_at)
             SELECT pc.store_id,pc.product_id,i.id,pc.quantity,pc.created_at,pc.updated_at
             FROM product_components pc
             INNER JOIN ingredients i
               ON i.legacy_product_id COLLATE utf8mb4_unicode_ci =
                  pc.component_product_id COLLATE utf8mb4_unicode_ci'
        );
    }

        $markMigration = db()->prepare(
            'INSERT IGNORE INTO app_schema_migrations (migration_key) VALUES (:migration_key)'
        );
        $markMigration->execute(['migration_key' => $migrationKey]);
        $ensured = true;
    } finally {
        db()->query("SELECT RELEASE_LOCK('tn_company_ingredients_schema_v2')");
    }
}

function ingredients_find(string $storeId, string $idOrCode): ?array
{
    ingredients_ensure_schema();
    $statement = db()->prepare(
        'SELECT i.*,s.supplier_code,s.supplier_name
         FROM ingredients i
         LEFT JOIN suppliers s
           ON s.id COLLATE utf8mb4_unicode_ci=i.supplier_id COLLATE utf8mb4_unicode_ci
         WHERE i.store_id=:store_id
           AND (i.id=:value OR i.ingredient_code=:value)
         LIMIT 1'
    );
    $statement->execute(['store_id' => $storeId, 'value' => $idOrCode]);
    $row = $statement->fetch();
    return $row ?: null;
}

function ingredients_next_code(string $prefix, string $table, string $column): string
{
    if (!in_array($table, ['ingredients', 'suppliers'], true)
        || !in_array($column, ['ingredient_code', 'supplier_code'], true)) {
        throw new InvalidArgumentException('Invalid code source.');
    }
    $statement = db()->query(
        sprintf(
            "SELECT `%s` FROM `%s`
             WHERE UPPER(`%s`) REGEXP '^%s[0-9]+$'
             ORDER BY CAST(SUBSTRING(`%s`, %d) AS UNSIGNED) DESC LIMIT 1",
            $column,
            $table,
            $column,
            $prefix,
            $column,
            strlen($prefix) + 1
        )
    );
    $current = (string) ($statement->fetchColumn() ?: '');
    return $prefix . ($current === '' ? '1' : (string) ((int) substr($current, strlen($prefix)) + 1));
}
