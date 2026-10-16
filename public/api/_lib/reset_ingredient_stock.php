<?php
declare(strict_types=1);

function reset_ingredient_stock(PDO $pdo, array $actor, string $storeId): int
{
    if (($actor['role'] ?? '') !== 'admin') {
        throw new DomainException('Chỉ quản trị viên được reset tồn nguyên liệu.', 403);
    }
    if ($storeId !== 'restaurant') {
        throw new DomainException('Chức năng reset tồn nguyên liệu chỉ áp dụng cho khu Lẩu / Bếp.', 422);
    }
    $statement = $pdo->prepare('UPDATE ingredients SET stock_quantity=0 WHERE store_id=:store AND stock_quantity<>0');
    $statement->execute(['store'=>$storeId]);
    return $statement->rowCount();
}
