<?php
declare(strict_types=1);
function pos_linked_stock_ensure(): void {
 db()->exec('CREATE TABLE IF NOT EXISTS inventory_pos_links (
 id VARCHAR(64) PRIMARY KEY,store_id VARCHAR(32) NOT NULL,stock_key CHAR(64) NOT NULL,
 product_code VARCHAR(255) NOT NULL,product_name VARCHAR(255) NOT NULL,unit VARCHAR(100) NOT NULL,
 pos_code VARCHAR(100) NOT NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),created_by VARCHAR(64) NOT NULL,
 UNIQUE KEY uniq_stock (store_id,stock_key),UNIQUE KEY uniq_pos (store_id,pos_code)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
 auth_ensure_column('inventory_pos_links','sales_start_at','DATETIME NULL');
 db()->exec('CREATE TABLE IF NOT EXISTS inventory_equipment_adjustments (
 id VARCHAR(64) PRIMARY KEY,store_id VARCHAR(32) NOT NULL,stock_key CHAR(64) NOT NULL,
 effective_date DATE NOT NULL,quantity DECIMAL(15,3) NOT NULL,stock_before DECIMAL(15,3) NOT NULL,
 stock_after DECIMAL(15,3) NOT NULL,reason TEXT NOT NULL,created_by VARCHAR(64) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY idx_equipment_adjustments (store_id,stock_key,effective_date)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
 db()->exec('CREATE TABLE IF NOT EXISTS inventory_equipment_edits (
 id VARCHAR(64) PRIMARY KEY,store_id VARCHAR(32) NOT NULL,before_json TEXT NOT NULL,after_json TEXT NOT NULL,
 created_by VARCHAR(64) NOT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

}
function pos_linked_stock_balance(array $link,string $date): array {
 $end=(new DateTimeImmutable($date))->modify('+1 day')->format('Y-m-d');
 $q=db()->prepare('SELECT COALESCE(SUM(i.quantity),0) total,
 COALESCE(SUM(CASE WHEN r.receipt_date < :day THEN i.quantity ELSE 0 END),0) before_day,
 COALESCE(SUM(CASE WHEN r.receipt_date=:today THEN i.quantity ELSE 0 END),0) received
 FROM inventory_receipt_items i JOIN inventory_receipts r ON r.id=i.receipt_id
 WHERE r.store_id=:store AND (r.status="completed" OR (r.status="deleted" AND r.previous_status="completed"))
 AND i.item_type="equipment" AND i.product_code=:code AND i.product_name=:name AND i.unit=:unit AND r.receipt_date < :end');
 $q->execute(['day'=>$date,'today'=>$date,'store'=>$link['store_id'],'code'=>$link['product_code'],'name'=>$link['product_name'],'unit'=>$link['unit'],'end'=>$end]);$in=$q->fetch();
 $out=['total'=>0,'before_day'=>0,'sold'=>0];
 if (($link['pos_code']??'') !== '') {
 $q=db()->prepare('SELECT COALESCE(SUM(i.quantity),0) total,
 COALESCE(SUM(CASE WHEN b.created_at < :day THEN i.quantity ELSE 0 END),0) before_day,
 COALESCE(SUM(CASE WHEN b.created_at >= :today THEN i.quantity ELSE 0 END),0) sold
 FROM bill_items i JOIN bills b ON b.id=i.bill_id
 WHERE b.store_id=:store AND b.status="completed" AND i.menu_id=:pos
 AND b.created_at>=:linked AND b.created_at < :end');
 $q->execute(['day'=>$date.' 00:00:00','today'=>$date.' 00:00:00','store'=>$link['store_id'],'pos'=>$link['pos_code'],'linked'=>$link['sales_start_at']??$link['created_at'],'end'=>$end.' 00:00:00']);$out=$q->fetch();
 }
 $adjustment=pos_equipment_adjustments($link,$date);
 return ['posCode'=>$link['pos_code'],'opening'=>round((float)$in['before_day']-(float)$out['before_day']+$adjustment['before_day'],3),'received'=>(float)$in['received'],'sold'=>(float)$out['sold'],'quantity'=>round((float)$in['total']-(float)$out['total']+$adjustment['total'],3),'adjusted'=>$adjustment['total']-$adjustment['before_day'],'linkedAt'=>$link['created_at'],'salesStartAt'=>$link['sales_start_at']??$link['created_at']];
}

function pos_stock_key(array $item): string {
 return hash('sha256',json_encode([$item['product_code'],$item['product_name'],$item['unit']]));
}
function pos_equipment_adjustments(array $item,string $date): array {
 $q=db()->prepare('SELECT COALESCE(SUM(quantity),0) total,
 COALESCE(SUM(CASE WHEN effective_date < :day THEN quantity ELSE 0 END),0) before_day
 FROM inventory_equipment_adjustments WHERE store_id=:store AND stock_key=:stock AND effective_date<=:end');
 $q->execute(['day'=>$date,'store'=>$item['store_id'],'stock'=>pos_stock_key($item),'end'=>$date]);
 $row=$q->fetch();return ['total'=>(float)$row['total'],'before_day'=>(float)$row['before_day']];
}
function pos_stock_date(string $date): string {
 $parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date);
 if (!$parsed || $parsed->format('Y-m-d')!==$date) throw new InvalidArgumentException('Ngày không hợp lệ.');
 return $date;
}
// Caller holds a store edit lock and a transaction. Receipt quantities and costs remain intact.
function pos_equipment_edit(array $original,array $next,array $user,string $date,?float $quantity,string $reason): void {
 if (($user['role']??'')!=='admin') throw new InvalidArgumentException('Chỉ admin được sửa hàng tồn.');
 if (!db()->inTransaction()) throw new LogicException('Stock edit requires a transaction.');
 pos_stock_date($date);
 foreach (['product_code','product_name','unit'] as $field) {
  if (trim($next[$field]??'')==='') throw new InvalidArgumentException('Vui lòng nhập mã, tên và đơn vị.');
 }
 if ($quantity!==null && (!is_finite($quantity)||$quantity<0||trim($reason)==='')) throw new InvalidArgumentException('Số tồn phải không âm và cần lý do điều chỉnh.');
 $params=['store'=>$original['store_id'],'code'=>$original['product_code'],'name'=>$original['product_name'],'unit'=>$original['unit']];
 $q=db()->prepare('SELECT i.id FROM inventory_receipt_items i JOIN inventory_receipts r ON r.id=i.receipt_id WHERE r.store_id=:store AND i.item_type="equipment" AND i.product_code=:code AND i.product_name=:name AND i.unit=:unit');
 $q->execute($params);$originalIds=$q->fetchAll(PDO::FETCH_COLUMN);if (!$originalIds) throw new InvalidArgumentException('Không tìm thấy hàng trong kho.');
 $oldKey=pos_stock_key($original);$newKey=pos_stock_key($next);
 if ($oldKey!==$newKey) {
  $q->execute(['store'=>$original['store_id'],'code'=>$next['product_code'],'name'=>$next['product_name'],'unit'=>$next['unit']]);
  foreach ($q->fetchAll(PDO::FETCH_COLUMN) as $id) {
   if (!in_array($id,$originalIds,true)) throw new InvalidArgumentException('Thông tin trùng với hàng khác trong kho.');
  }
 }
 $q=db()->prepare('SELECT * FROM inventory_pos_links WHERE store_id=:store AND stock_key=:key');
 $q->execute(['store'=>$original['store_id'],'key'=>$oldKey]);$link=$q->fetch();
 $balance=pos_linked_stock_balance($link?:($original+['pos_code'=>'','created_at'=>$date.' 00:00:00']),$date);
 if ($oldKey!==$newKey) {
  $q=db()->prepare('UPDATE inventory_receipt_items SET product_code=:new_code,product_name=:new_name,unit=:new_unit WHERE item_type="equipment" AND product_code=:code AND product_name=:name AND unit=:unit AND receipt_id IN (SELECT id FROM inventory_receipts WHERE store_id=:store)');
  $q->execute($params+['new_code'=>$next['product_code'],'new_name'=>$next['product_name'],'new_unit'=>$next['unit']]);
  $q=db()->prepare('UPDATE inventory_pos_links SET stock_key=:new_key,product_code=:code,product_name=:name,unit=:unit WHERE store_id=:store AND stock_key=:old_key');
  $q->execute(['new_key'=>$newKey,'code'=>$next['product_code'],'name'=>$next['product_name'],'unit'=>$next['unit'],'store'=>$original['store_id'],'old_key'=>$oldKey]);
  db()->prepare('UPDATE inventory_equipment_adjustments SET stock_key=:new_key WHERE store_id=:store AND stock_key=:old_key')->execute(['new_key'=>$newKey,'store'=>$original['store_id'],'old_key'=>$oldKey]);
 }
 if ($quantity!==null) {
  $delta=round($quantity-$balance['quantity'],3);
  if ($delta!==0.0) db()->prepare('INSERT INTO inventory_equipment_adjustments(id,store_id,stock_key,effective_date,quantity,stock_before,stock_after,reason,created_by) VALUES (:id,:store,:key,:date,:quantity,:before,:after,:reason,:actor)')->execute(['id'=>uuidv4(),'store'=>$original['store_id'],'key'=>$newKey,'date'=>$date,'quantity'=>$delta,'before'=>$balance['quantity'],'after'=>$quantity,'reason'=>$reason,'actor'=>$user['id']]);
 }
 db()->prepare('INSERT INTO inventory_equipment_edits(id,store_id,before_json,after_json,created_by) VALUES (:id,:store,:before,:after,:actor)')->execute(['id'=>uuidv4(),'store'=>$original['store_id'],'before'=>json_encode($original+['quantity'=>$balance['quantity']]),'after'=>json_encode($next+['quantity'=>$quantity??$balance['quantity'],'date'=>$date,'reason'=>$reason]),'actor'=>$user['id']]);
}
