<?php
declare(strict_types=1);
/** Caller owns transaction; original posted quantities are already in base units. */
function inventory_reverse_receipt_stock(PDO $pdo, string $id, array $receipt, array $user, string $reason): void
{
    if (!$pdo->inTransaction()) throw new LogicException('Receipt reversal requires a transaction.');
    $checkId = uuidv4();
    $actor = $user['displayName'] ?? $user['username'] ?? $user['id'];
    $auditReason = 'Xoá phiếu nhập '.$receipt['receipt_code'].': '.$reason;
    $q = $pdo->prepare('SELECT m.ingredient_id,SUM(m.quantity) quantity FROM inventory_stock_movements m WHERE m.receipt_id=:id AND m.ingredient_id IS NOT NULL GROUP BY m.ingredient_id ORDER BY m.ingredient_id');
    $q->execute(['id'=>$id]); $movements=$q->fetchAll();
    if ($movements !== []) {
        $header=$pdo->prepare('INSERT INTO inventory_checks (id,store_id,check_code,check_date,status,note,completed_at,completed_by,created_by) VALUES (:id,:store,:code,CURDATE(),"completed",:note,NOW(),:actor,:creator)');
        $header->execute(['id'=>$checkId,'store'=>$receipt['store_id'],'code'=>'XN-'.$id,'note'=>$auditReason,'actor'=>$actor,'creator'=>$actor]);
        $detail=$pdo->prepare('INSERT INTO inventory_check_items (check_id,ingredient_id,product_code,product_name,system_quantity,is_counted,actual_quantity,variance_quantity,unit_cost,variance_value,note) VALUES (:check_id,:ingredient,:code,:name,:before,1,:after,:variance,:cost,:value,:note)');
        foreach ($movements as $movement) {
            $lock=$pdo->prepare('SELECT * FROM ingredients WHERE id=:id AND store_id=:store '.($pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite'?'':' FOR UPDATE'));
            $lock->execute(['id'=>$movement['ingredient_id'],'store'=>$receipt['store_id']]);$ingredient=$lock->fetch();
            if (!$ingredient) throw new RuntimeException('Không tìm thấy nguyên liệu để hoàn tác.');
            $before=(float)$ingredient['stock_quantity'];$delta=-(float)$movement['quantity'];$after=round($before+$delta,3);
            $detail->execute(['check_id'=>$checkId,'ingredient'=>$ingredient['id'],'code'=>$ingredient['ingredient_code'],'name'=>$ingredient['ingredient_name'],'before'=>$before,'after'=>$after,'variance'=>$delta,'cost'=>(float)$ingredient['cost'],'value'=>$delta*(float)$ingredient['cost'],'note'=>$auditReason]);
            $pdo->prepare('UPDATE ingredients SET stock_quantity=:stock,updated_at=NOW() WHERE id=:id')->execute(['stock'=>$after,'id'=>$ingredient['id']]);
        }
        $pdo->prepare('UPDATE inventory_checks SET counted_item_count=(SELECT COUNT(*) FROM inventory_check_items WHERE check_id=:items),decrease_quantity_total=(SELECT COALESCE(SUM(-variance_quantity),0) FROM inventory_check_items WHERE check_id=:decreases) WHERE id=:id')->execute(['items'=>$checkId,'decreases'=>$checkId,'id'=>$checkId]);
    }
}
