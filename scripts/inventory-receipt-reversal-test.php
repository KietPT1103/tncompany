<?php
declare(strict_types=1);
require_once __DIR__.'/../public/api/_lib/inventory_receipt_reversal.php';
function uuidv4(): string {return bin2hex(random_bytes(16));}
function check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->sqliteCreateFunction('NOW',fn()=>'2026-10-21 10:00:00');$pdo->sqliteCreateFunction('CURDATE',fn()=>'2026-10-21');
$pdo->exec('CREATE TABLE ingredients(id TEXT,store_id TEXT,ingredient_code TEXT,ingredient_name TEXT,stock_quantity REAL,cost REAL,updated_at TEXT)');
$pdo->exec("INSERT INTO ingredients VALUES('salt','cafe','NL1','Salt',20,100,NULL)");
$pdo->exec('CREATE TABLE inventory_stock_movements(ingredient_id TEXT,receipt_id TEXT,quantity REAL)');
$pdo->exec("INSERT INTO inventory_stock_movements VALUES('salt','r1',4),('salt','r1',3),('salt','other',100)");
$pdo->exec('CREATE TABLE inventory_checks(id TEXT,store_id TEXT,check_code TEXT,check_date TEXT,status TEXT,note TEXT,completed_at TEXT,completed_by TEXT,created_by TEXT,counted_item_count INTEGER,decrease_quantity_total REAL)');
$pdo->exec('CREATE TABLE inventory_check_items(check_id TEXT,ingredient_id TEXT,product_code TEXT,product_name TEXT,system_quantity REAL,is_counted INTEGER,actual_quantity REAL,variance_quantity REAL,unit_cost REAL,variance_value REAL,note TEXT)');
$receipt=['store_id'=>'cafe','receipt_code'=>'NK1'];$user=['id'=>'admin','displayName'=>'Admin'];
$pdo->beginTransaction();inventory_reverse_receipt_stock($pdo,'r1',$receipt,$user,'Duplicate receipt');$pdo->commit();
check((float)$pdo->query('SELECT stock_quantity FROM ingredients')->fetchColumn()===13.0,'reverse only posted receipt base quantities');
$audit=$pdo->query('SELECT * FROM inventory_check_items')->fetch();
check((float)$audit['system_quantity']===20.0&&(float)$audit['actual_quantity']===13.0&&(float)$audit['variance_quantity']===-7.0,'audit before/after/delta');
check(str_contains($audit['note'],'NK1')&&str_contains($audit['note'],'Duplicate receipt'),'audit source and reason');
$header=$pdo->query('SELECT * FROM inventory_checks')->fetch();check($header['completed_by']==='Admin'&&$header['completed_at']==='2026-10-21 10:00:00','audit actor and time');
$pdo->exec("INSERT INTO inventory_stock_movements VALUES('zzmissing','bad',1),('salt','bad',2)");
$pdo->beginTransaction();try{inventory_reverse_receipt_stock($pdo,'bad',$receipt,$user,'Fail rollback');throw new LogicException('Expected missing ingredient failure');}catch(RuntimeException $e){$pdo->rollBack();}
check((float)$pdo->query('SELECT stock_quantity FROM ingredients')->fetchColumn()===13.0,'rollback stock on failure');
check((int)$pdo->query('SELECT COUNT(*) FROM inventory_checks')->fetchColumn()===1,'rollback audit on failure');
echo "PASS receipt reversal: posted base quantity, before/after, reason, actor, rollback\n";
