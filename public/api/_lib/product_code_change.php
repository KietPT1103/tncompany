<?php
declare(strict_types=1);

function products_change_code(PDO $pdo, string $storeId, string $productId, string $newCode): string
{
    $newCode = trim($newCode);
    if ($newCode === '' || mb_strlen($newCode, 'UTF-8') > 100 || preg_match('/[\x00-\x1F\x7F]/u', $newCode)) {
        throw new DomainException('Mã hàng hóa phải có từ 1 đến 100 ký tự và không chứa ký tự điều khiển.', 422);
    }
    $find = $pdo->prepare('SELECT id FROM products WHERE id=:id AND store_id=:store');
    $find->execute(['id'=>$productId, 'store'=>$storeId]);
    if (!$find->fetchColumn()) throw new DomainException('Không tìm thấy hàng hóa.', 404);

    $duplicate = $pdo->prepare('SELECT id FROM products WHERE store_id=:store AND LOWER(product_code)=LOWER(:code) AND id<>:id LIMIT 1');
    $duplicate->execute(['store'=>$storeId, 'code'=>$newCode, 'id'=>$productId]);
    if ($duplicate->fetchColumn()) throw new DomainException('Mã hàng hóa đã được sử dụng trong khu vực này.', 409);

    $update = $pdo->prepare('UPDATE products SET product_code=:code WHERE id=:id AND store_id=:store');
    $update->execute(['code'=>$newCode, 'id'=>$productId, 'store'=>$storeId]);
    return $newCode;
}
