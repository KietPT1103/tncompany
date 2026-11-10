<?php
declare(strict_types=1);

/** Product names belong to a store; retain the existing global product-code check. */
function products_find_create_duplicate(PDO $pdo,string $storeId,string $code,string $itemType,string $normalizedName,string $name): ?array
{
    $statement=$pdo->prepare(
        'SELECT id,store_id,product_code,product_name,unit FROM products
         WHERE LOWER(product_code)=LOWER(:code)
            OR (store_id=:store_id AND item_type=:item_type AND (
                normalized_name=:normalized
                OR LOWER(TRIM(product_name))=LOWER(TRIM(:name))
            ))
         LIMIT 1'
    );
    $statement->execute(['code'=>$code,'store_id'=>$storeId,'item_type'=>$itemType,'normalized'=>$normalizedName,'name'=>$name]);
    $row=$statement->fetch(PDO::FETCH_ASSOC);
    return $row===false?null:$row;
}
