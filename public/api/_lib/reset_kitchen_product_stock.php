<?php
declare(strict_types=1);

function reset_kitchen_product_stock(PDO $pdo, array $actor, string $storeId): int
{
    if (($actor['role'] ?? '') !== 'admin') {
        throw new DomainException('Chỉ quản trị viên được reset tồn kho hàng hóa.', 403);
    }
    if ($storeId !== 'restaurant') {
        throw new DomainException('Chức năng này chỉ áp dụng cho hàng hóa bên Bếp.', 422);
    }

    // Match the catalog API: legacy ingredient-category rows are not sale products.
    $categories = $pdo->prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(:name)');
    $categories->execute(['name' => 'Nguyên liệu']);
    $excludedIds = $categories->fetchAll(PDO::FETCH_COLUMN);
    $params = ['store' => 'restaurant', 'type' => 'product'];
    $sql = 'UPDATE products SET stock_quantity=0
            WHERE store_id=:store AND item_type=:type AND stock_quantity<>0';
    if ($excludedIds !== []) {
        $placeholders = [];
        foreach ($excludedIds as $index => $id) {
            $key = 'category_' . $index;
            $placeholders[] = ':' . $key;
            $params[$key] = $id;
        }
        $sql .= ' AND (category_id IS NULL OR category_id NOT IN (' . implode(',', $placeholders) . '))';
    }
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    return $statement->rowCount();
}
