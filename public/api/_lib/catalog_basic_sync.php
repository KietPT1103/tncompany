<?php
declare(strict_types=1);

/** Preview or apply a catalog sync. Existing records retain every field except name and price. */
function catalog_basic_sync(PDO $pdo, array $actor, string $storeId, array $items, bool $apply, ?string $previewToken, callable $createId): array
{
    if (($actor['role'] ?? '') !== 'admin') throw new DomainException('Chỉ quản trị viên được đồng bộ danh mục.', 403);
    if (!in_array($storeId, ['cafe','restaurant','bakery','farm','warehouse'], true)) throw new DomainException('Khu vực không hợp lệ.', 422);
    if ($items === [] || count($items) > 5000) throw new DomainException('File phải có từ 1 đến 5.000 món.', 422);
    $normalized = [];
    $seen = [];
    foreach (array_values($items) as $index => $item) {
        if (!is_array($item) || !is_string($item['product_code'] ?? null) || !is_string($item['product_name'] ?? null)) {
            throw new DomainException('Mã và tên món không hợp lệ tại dòng ' . ($index + 1) . '.', 422);
        }
        $code = trim($item['product_code']);
        $name = trim($item['product_name']);
        $price = $item['price'] ?? null;
        if ($code === '' || mb_strlen($code) > 100 || preg_match('/[\x00-\x1F\x7F]/u', $code) || $name === '' || mb_strlen($name) > 255 || !is_numeric($price) || !is_finite((float)$price) || (float)$price < 0 || (float)$price >= 1e13) {
            throw new DomainException('Mã, tên hoặc giá bán không hợp lệ tại dòng ' . ($index + 1) . '.', 422);
        }
        $key = mb_strtolower($code, 'UTF-8');
        if (isset($seen[$key])) throw new DomainException('File có mã món trùng: ' . $code, 422);
        $seen[$key] = true;
        $roundedPrice = round((float)$price, 2);
        if ($roundedPrice >= 1e13) throw new DomainException('Giá bán vượt giới hạn tại dòng ' . ($index + 1) . '.', 422);
        $normalized[] = ['code'=>$code, 'name'=>$name, 'price'=>$roundedPrice];
    }

    $mysql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    $locked = false;
    try {
        if ($apply) {
            if ($mysql) {
                $locked = (int)$pdo->query("SELECT GET_LOCK('tn_company_products_sp_code', 10)")->fetchColumn() === 1;
                if (!$locked) throw new DomainException('Danh mục đang được cập nhật. Vui lòng thử lại.', 503);
            }
            $pdo->beginTransaction();
        }
        $find = $pdo->prepare('SELECT id,product_code,product_name,price,item_type FROM products WHERE store_id=:store AND LOWER(product_code)=LOWER(:code)' . ($apply && $mysql ? ' FOR UPDATE' : ''));
        $rows = [];
        $snapshot = [];
        $counts = ['createdCount'=>0, 'updatedCount'=>0, 'unchangedCount'=>0, 'skippedCount'=>0];
        foreach ($normalized as $item) {
            $find->execute(['store'=>$storeId, 'code'=>$item['code']]);
            $matches = $find->fetchAll(PDO::FETCH_ASSOC);
            if (count($matches) > 1) throw new DomainException('Có nhiều hàng hóa cùng mã ' . $item['code'] . '. Cần xử lý mã trùng trước.', 409);
            $old = $matches[0] ?? null;
            $oldPrice = $old && $old['price'] !== null ? (float)$old['price'] : null;
            $status = $old && ($old['item_type'] ?? '') !== 'product' ? 'skipped' : (!$old ? 'new' : (($old['product_name'] !== $item['name'] || $oldPrice !== $item['price']) ? 'updated' : 'unchanged'));
            $countKey = ['new'=>'createdCount', 'updated'=>'updatedCount', 'unchanged'=>'unchangedCount', 'skipped'=>'skippedCount'][$status];
            $counts[$countKey]++;
            $rows[] = ['code'=>$item['code'], 'name'=>$item['name'], 'price'=>$item['price'], 'oldName'=>$old['product_name'] ?? null, 'oldPrice'=>$oldPrice, 'status'=>$status];
            $snapshot[] = ['id'=>$old['id'] ?? null, 'itemType'=>$old['item_type'] ?? null, 'oldName'=>$old['product_name'] ?? null, 'oldPrice'=>$oldPrice, 'item'=>$item];
        }
        $token = hash('sha256', json_encode([$storeId, $snapshot], JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION | JSON_THROW_ON_ERROR));
        if ($apply) {
            if (!$previewToken || !hash_equals($token, $previewToken)) throw new DomainException('Danh mục đã thay đổi. Vui lòng cập nhật xem trước rồi xác nhận lại.', 409);
            $update = $pdo->prepare('UPDATE products SET product_name=:name,price=:price WHERE id=:id AND store_id=:store');
            $insert = $pdo->prepare('INSERT INTO products(id,store_id,product_code,product_name,price,cost,has_cost,is_selling,stock_quantity,item_type) VALUES(:id,:store,:code,:name,:price,NULL,0,1,0,\'product\')');
            foreach ($rows as $index=>$row) {
                if ($row['status'] === 'unchanged' || $row['status'] === 'skipped') continue;
                $params = ['id'=>$snapshot[$index]['id'] ?? $createId(), 'store'=>$storeId, 'name'=>$row['name'], 'price'=>$row['price']];
                if ($row['status'] === 'new') {
                    $params['code'] = $row['code'];
                    $insert->execute($params);
                } else {
                    $update->execute($params);
                }
            }
            $pdo->commit();
        }
        return ['applied'=>$apply, 'storeId'=>$storeId, 'totalCount'=>count($rows), ...$counts, 'previewToken'=>$token, 'rows'=>$rows];
    } catch (Throwable $error) {
        if ($apply && $pdo->inTransaction()) $pdo->rollBack();
        if ($error instanceof PDOException && (int)($error->errorInfo[1] ?? 0) === 1062) throw new DomainException('Mã món vừa được sử dụng. Vui lòng cập nhật xem trước.', 409);
        throw $error;
    } finally {
        if ($locked) $pdo->query("SELECT RELEASE_LOCK('tn_company_products_sp_code')")->fetchColumn();
    }
}
