<?php
declare(strict_types=1);
require_once __DIR__.'/../public/api/_lib/pos_linked_stock.php';
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
function db(){global $pdo;return $pdo;}
$pdo->exec('CREATE TABLE inventory_receipts(id TEXT,store_id TEXT,status TEXT,previous_status TEXT,receipt_date TEXT)');
$pdo->exec('CREATE TABLE inventory_receipt_items(receipt_id TEXT,item_type TEXT,product_code TEXT,product_name TEXT,unit TEXT,quantity REAL)');
$pdo->exec('CREATE TABLE bills(id TEXT,store_id TEXT,status TEXT,created_at TEXT)');
$pdo->exec('CREATE TABLE bill_items(bill_id TEXT,menu_id TEXT,quantity REAL)');
$pdo->exec("INSERT INTO inventory_receipts VALUES ('old','cafe','completed',NULL,'2026-10-16'),('new','cafe','completed',NULL,'2026-10-17'),('draft','cafe','draft',NULL,'2026-10-17')");
$pdo->exec("INSERT INTO inventory_receipt_items VALUES ('old','equipment','CAKE','Cake','piece',5),('new','equipment','CAKE','Cake','piece',20),('draft','equipment','CAKE','Cake','piece',100)");
$pdo->exec("INSERT INTO bills VALUES ('old-sale','cafe','completed','2026-10-15 10:00:00'),('sale','cafe','completed','2026-10-17 10:00:00'),('other','farm','completed','2026-10-17 11:00:00')");
$pdo->exec("INSERT INTO bill_items VALUES ('old-sale','POS-CAKE',50),('sale','POS-CAKE',8),('other','POS-CAKE',90)");
$link=['store_id'=>'cafe','product_code'=>'CAKE','product_name'=>'Cake','unit'=>'piece','pos_code'=>'POS-CAKE','created_at'=>'2026-10-16 00:00:00'];
function check($condition,$message){if(!$condition)throw new RuntimeException($message);}
$r=pos_linked_stock_balance($link,'2026-10-17');check($r['opening']===5.0&&$r['received']===20.0&&$r['sold']===8.0&&$r['quantity']===17.0,'Daily balance and store isolation');
check(pos_linked_stock_balance($link,'2026-10-17')===$r,'Repeated reads never deduct twice');
$pdo->exec("UPDATE bills SET status='cancelled' WHERE id='sale'");check(pos_linked_stock_balance($link,'2026-10-17')['quantity']===25.0,'Cancel restores stock');
$pdo->exec("UPDATE bills SET status='completed' WHERE id='sale'");$pdo->exec("UPDATE bill_items SET quantity=3 WHERE bill_id='sale'");check(pos_linked_stock_balance($link,'2026-10-17')['quantity']===22.0,'Bill edit updates quantity');
check(pos_linked_stock_balance($link,'2026-10-16')['quantity']===5.0,'Historical date excludes future activity');
$pdo->exec("UPDATE inventory_receipts SET status='deleted',previous_status='completed' WHERE id='new'");check(pos_linked_stock_balance($link,'2026-10-17')['quantity']===22.0,'Soft delete preserves posted inbound');
echo "PASS linked POS stock: opening/inbound/sold/closing, repeat safety, cancellation, edits, history, store isolation, drafts, activation boundary\n";
