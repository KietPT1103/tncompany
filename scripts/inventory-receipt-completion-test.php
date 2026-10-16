<?php
declare(strict_types=1);
require_once __DIR__.'/../public/api/_lib/inventory_receipt_completion.php';
class CompletionDatabase extends PDO {
 public function prepare(string $query, array $options=[]): PDOStatement|false { return parent::prepare(str_replace(' FOR UPDATE','',$query),$options); }
}
$pdo=new CompletionDatabase('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->sqliteCreateFunction('NOW',fn()=> '2026-10-16 12:00:00');
$pdo->sqliteCreateFunction('GREATEST',fn(...$values)=>max($values));
function db() { global $pdo; return $pdo; }
function uuidv4() { static $n=0; return 'movement-'.++$n; }
function field_inventory_load_receipt(string $id,bool $lock=false): ?array { $q=db()->prepare('SELECT * FROM inventory_receipts WHERE id=:id');$q->execute(['id'=>$id]);return $q->fetch()?:null; }
function field_inventory_can_edit_receipt(array $user,array $receipt): bool { return !$receipt['locked_at']||$user['role']==='admin'; }
function check(bool $condition,string $message): void { if(!$condition)throw new RuntimeException($message); }
$pdo->exec('CREATE TABLE inventory_receipts(id TEXT PRIMARY KEY,store_id TEXT,status TEXT,entry_source TEXT,supplier_id TEXT,order_creator_name TEXT,evidence_receipt_id TEXT,previous_status TEXT,locked_at TEXT,total_quantity REAL,total_amount REAL,completed_by TEXT,completed_by_user_id TEXT,completed_at TEXT,updated_at TEXT)');
$pdo->exec('CREATE TABLE ingredients(id TEXT PRIMARY KEY,stock_quantity REAL,store_id TEXT,item_kind TEXT,base_unit TEXT,unit TEXT,purchase_to_base_factor REAL,cost REAL)');
$pdo->exec('CREATE TABLE inventory_receipt_items(id INTEGER PRIMARY KEY,receipt_id TEXT,ingredient_id TEXT,item_type TEXT,quantity REAL,unit_cost REAL,line_total REAL,updated_at TEXT)');
$pdo->exec('CREATE TABLE inventory_receipt_images(id INTEGER PRIMARY KEY,receipt_id TEXT)');
$pdo->exec('CREATE TABLE inventory_stock_movements(id TEXT PRIMARY KEY,receipt_id TEXT,receipt_item_id INTEGER,store_id TEXT,product_id TEXT,ingredient_id TEXT,quantity REAL,stock_before REAL,stock_after REAL,created_by TEXT,UNIQUE(receipt_id,receipt_item_id))');
$pdo->exec("INSERT INTO ingredients VALUES ('a',10,'cafe','ingredient','g','g',1000,0),('f',0,'cafe','fresh','kg','kg',1,0)");
$user=['id'=>'u','displayName'=>'Employee','role'=>'user'];
function receipt(string $id,string $source='mobile_photo',?string $evidence=null): void {
 $q=db()->prepare('INSERT INTO inventory_receipts(id,store_id,status,entry_source,supplier_id,order_creator_name,evidence_receipt_id) VALUES (:id,"cafe","draft",:source,"supplier","Employee",:evidence)');$q->execute(['id'=>$id,'source'=>$source,'evidence'=>$evidence]);
 if($source==='mobile_photo')db()->prepare('INSERT INTO inventory_receipt_images(receipt_id) VALUES (:id)')->execute(['id'=>$id]);
}
function line(string $receipt,float $quantity,string $ingredient='a',string $type='ingredient'): void { $q=db()->prepare('INSERT INTO inventory_receipt_items(receipt_id,ingredient_id,item_type,quantity,unit_cost) VALUES (:receipt,:ingredient,:type,:quantity,20)');$q->execute(compact('receipt','ingredient','type','quantity')); }
function finish(string $id): bool { global $user;$pdo=db();$pdo->beginTransaction();try{$repeat=inventory_complete_receipt($id,$user);$pdo->commit();return $repeat;}catch(Throwable $error){$pdo->rollBack();throw $error;} }
function rejected(string $id): void { try{finish($id);}catch(ReceiptValidationException $error){return;}throw new RuntimeException('Expected rejection: '.$id); }
function stock(): float { return (float)db()->query('SELECT stock_quantity FROM ingredients WHERE id="a"')->fetchColumn(); }
receipt('manual','web_manual');line('manual',2);check(!finish('manual'),'First manual completion');check(stock()===2010.0,'Manual stock conversion');check(finish('manual'),'Repeated manual completion is idempotent');check(stock()===2010.0,'No repeated manual stock');
receipt('photo');line('photo',1);line('photo',0.5);finish('photo');check(stock()===3510.0,'Photo repeated ingredient lines accumulate');finish('photo');check(stock()===3510.0,'No repeated photo stock');
receipt('proof');receipt('linked','web_manual','proof');line('linked',1);finish('linked');check(stock()===4510.0,'Linked manual counts once');line('proof',9);rejected('proof');check(stock()===4510.0,'Linked evidence cannot complete independently');
$pdo->exec('UPDATE inventory_receipts SET previous_status="completed",status="deleted" WHERE id="linked"');rejected('proof');check(stock()===4510.0,'Deleted completed target still blocks evidence reuse');
receipt('bad','web_manual');line('bad',1);line('bad',-1);rejected('bad');check(stock()===4510.0,'Failed completion rolls back stock');check(field_inventory_load_receipt('bad')['status']==='draft','Failed completion stays draft');check((int)$pdo->query('SELECT COUNT(*) FROM inventory_stock_movements WHERE receipt_id="bad"')->fetchColumn()===0,'Failed completion rolls back movement');
receipt('special');line('special',3,'f');line('special',4,'','equipment');finish('special');check(stock()===4510.0,'Equipment/fresh do not alter raw stock');check((float)field_inventory_load_receipt('special')['total_quantity']===7.0,'Equipment/fresh included in receipt totals');
receipt('locked');line('locked',1);$pdo->exec('UPDATE inventory_receipts SET locked_at="2026-10-16" WHERE id="locked"');rejected('locked');
receipt('missing-photo');line('missing-photo',1);$pdo->exec('DELETE FROM inventory_receipt_images WHERE receipt_id="missing-photo"');finish('missing-photo');check(stock()===5510.0,'Receipt without image posts stock');finish('missing-photo');check(stock()===5510.0,'Receipt without image posts once');
check((int)$pdo->query('SELECT COUNT(*) FROM inventory_stock_movements')->fetchColumn()===5,'Exactly one movement per stock-bearing line');

$manual=file_get_contents(__DIR__.'/../public/api/inventory-manual-receipts.php');
check(str_contains($manual, "respond_error('Vui lòng tạo phiếu nhập tại Kho minh chứng.', 410)"),'Legacy manual creation is disabled');
echo "PASS unified receipt entry: photo optional, stock posted once, conversion, linked evidence, rollback, locks, equipment/fresh, legacy endpoint disabled\n";
