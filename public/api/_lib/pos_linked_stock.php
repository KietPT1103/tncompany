<?php
declare(strict_types=1);
function pos_linked_stock_ensure(): void {
 db()->exec('CREATE TABLE IF NOT EXISTS inventory_pos_links (
 id VARCHAR(64) PRIMARY KEY,store_id VARCHAR(32) NOT NULL,stock_key CHAR(64) NOT NULL,
 product_code VARCHAR(255) NOT NULL,product_name VARCHAR(255) NOT NULL,unit VARCHAR(100) NOT NULL,
 pos_code VARCHAR(100) NOT NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),created_by VARCHAR(64) NOT NULL,
 UNIQUE KEY uniq_stock (store_id,stock_key),UNIQUE KEY uniq_pos (store_id,pos_code)
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
 $q=db()->prepare('SELECT COALESCE(SUM(i.quantity),0) total,
 COALESCE(SUM(CASE WHEN b.created_at < :day THEN i.quantity ELSE 0 END),0) before_day,
 COALESCE(SUM(CASE WHEN b.created_at >= :today THEN i.quantity ELSE 0 END),0) sold
 FROM bill_items i JOIN bills b ON b.id=i.bill_id
 WHERE b.store_id=:store AND b.status="completed" AND i.menu_id=:pos
 AND b.created_at>=:linked AND b.created_at < :end');
 $q->execute(['day'=>$date.' 00:00:00','today'=>$date.' 00:00:00','store'=>$link['store_id'],'pos'=>$link['pos_code'],'linked'=>$link['created_at'],'end'=>$end.' 00:00:00']);$out=$q->fetch();
 return ['posCode'=>$link['pos_code'],'opening'=>round((float)$in['before_day']-(float)$out['before_day'],3),'received'=>(float)$in['received'],'sold'=>(float)$out['sold'],'quantity'=>round((float)$in['total']-(float)$out['total'],3),'linkedAt'=>$link['created_at']];
}
