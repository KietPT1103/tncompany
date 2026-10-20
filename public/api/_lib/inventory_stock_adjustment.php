<?php
declare(strict_types=1);

/** Quantity is in purchase units; expectedStock and saved audit quantities are in base units. */
function inventory_stock_adjust(PDO $pdo, string $role, string $storeId, string $actor, array $body): string
{
    if ($role !== 'admin') throw new RuntimeException('Chỉ admin được điều chỉnh tồn kho.', 403);
    $reason = trim((string)($body['reason'] ?? ''));
    if ($reason === '' || mb_strlen($reason) > 1000) throw new RuntimeException('Vui lòng nhập lý do (tối đa 1000 ký tự).', 422);
    foreach (['quantity','expectedStock'] as $key) {
        if (!isset($body[$key]) || !is_numeric($body[$key]) || !is_finite((float)$body[$key])) throw new RuntimeException('Số lượng không hợp lệ.', 422);
    }
    if ((float)$body['quantity'] < 0) throw new RuntimeException('Tồn mới phải lớn hơn hoặc bằng 0.', 422);
    $pdo->beginTransaction();
    try {
        $suffix = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
        $lock = $pdo->prepare('SELECT * FROM ingredients WHERE id=:id AND store_id=:store' . $suffix);
        $lock->execute(['id'=>(string)($body['ingredientId'] ?? ''),'store'=>$storeId]);
        $item = $lock->fetch();
        $lock->closeCursor();
        if (!$item) throw new RuntimeException('Không tìm thấy nguyên liệu trong kho.', 404);
        $before = (float)$item['stock_quantity'];
        if (abs($before - (float)$body['expectedStock']) > 0.000001) throw new RuntimeException('Tồn kho đã thay đổi. Vui lòng tải lại trang trước khi sửa.', 409);
        $factor = (float)($item['purchase_to_base_factor'] ?? 1);
        if ($factor <= 0 || !is_finite($factor)) throw new RuntimeException('Hệ số quy đổi không hợp lệ.', 422);
        $after = round((float)$body['quantity'] * $factor, 3);
        if (!is_finite($after) || $after > 999999999999.999) throw new RuntimeException('Số lượng vượt giới hạn.', 422);
        if ($after === $before) throw new RuntimeException('Tồn mới không thay đổi.', 422);
        $difference = round($after-$before,3);
        $value = round($difference*(float)$item['cost'],2);
        $id = uuidv4();
        $code = 'DC-' . $id;
        $insert = $pdo->prepare('INSERT INTO inventory_checks (id,store_id,check_code,check_date,status,note,counted_item_count,total_actual_quantity,total_variance_quantity,increase_quantity_total,decrease_quantity_total,variance_value_total,completed_at,completed_by,created_by) VALUES (:id,:store,:code,:date,"completed",:note,1,:actual,:variance,:increase,:decrease,:value,NOW(),:completed_by,:created_by)');
        $insert->execute(['id'=>$id,'store'=>$storeId,'code'=>$code,'date'=>(new DateTimeImmutable('now',new DateTimeZone('Asia/Ho_Chi_Minh')))->format('Y-m-d'),'note'=>$reason,'actual'=>$after,'variance'=>$difference,'increase'=>max(0,$difference),'decrease'=>max(0,-$difference),'value'=>$value,'completed_by'=>$actor,'created_by'=>$actor]);
        $detail = $pdo->prepare('INSERT INTO inventory_check_items (check_id,product_id,ingredient_id,product_code,product_name,system_quantity,is_counted,actual_quantity,variance_quantity,unit_cost,variance_value,note) VALUES (:check_id,NULL,:ingredient,:code,:name,:before,1,:after,:difference,:cost,:value,:note)');
        $detail->execute(['check_id'=>$id,'ingredient'=>$item['id'],'code'=>$item['ingredient_code'],'name'=>$item['ingredient_name'],'before'=>$before,'after'=>$after,'difference'=>$difference,'cost'=>(float)($item['cost'] ?? 0),'value'=>$value,'note'=>$reason]);
        $update = $pdo->prepare('UPDATE ingredients SET stock_quantity=:stock,updated_at=NOW() WHERE id=:id AND store_id=:store');
        $update->execute(['stock'=>$after,'id'=>$item['id'],'store'=>$storeId]);
        $pdo->commit();
        return $id;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}
