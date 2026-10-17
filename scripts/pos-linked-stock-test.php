<?php
declare(strict_types=1);
require_once __DIR__.'/../public/api/_lib/pos_linked_stock.php';
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
function db(){global $pdo;return $pdo;}
$pdo->exec('CREATE TABLE inventory_receipts(id TEXT,store_id TEXT,status TEXT,previous_status TEXT,receipt_date TEXT)');
$pdo->exec('CREATE TABLE inventory_receipt_items(receipt_id TEXT,item_type TEXT,product_code TEXT COLLATE NOCASE,product_name TEXT COLLATE NOCASE,unit TEXT COLLATE NOCASE,quantity REAL)');
$pdo->exec('CREATE TABLE inventory_equipment_adjustments(id TEXT,store_id TEXT,stock_key TEXT,effective_date TEXT,quantity REAL,stock_before REAL,stock_after REAL,reason TEXT,created_by TEXT,created_at TEXT)');
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

$link['created_at']='2026-10-18 10:00:00';
$link['sales_start_at']='2026-10-17 00:00:00';
check(pos_linked_stock_balance($link,'2026-10-17')['quantity']===22.0,'Backdated sales start includes old completed bills');
$key=hash('sha256',json_encode(['CAKE','Cake','piece']));
$pdo->exec("INSERT INTO inventory_equipment_adjustments VALUES ('fix','cafe','$key','2026-10-17',-2,22,20,'Counted','admin','2026-10-18')");
check(pos_linked_stock_balance($link,'2026-10-17')['quantity']===20.0,'Stock adjustment applies exactly once');
check(pos_linked_stock_balance($link,'2026-10-16')['quantity']===5.0,'Historical balance excludes future corrections');
check(pos_linked_stock_balance($link,'2026-10-18')['opening']===20.0,'Correction carries into next opening');
echo "PASS backdated sales and dated stock corrections\n";

$pdo->exec('ALTER TABLE inventory_receipt_items ADD COLUMN id INTEGER');
$pdo->exec('UPDATE inventory_receipt_items SET id=rowid');
$pdo->exec('CREATE TABLE inventory_pos_links(id TEXT,store_id TEXT,stock_key TEXT UNIQUE,product_code TEXT,product_name TEXT,unit TEXT,pos_code TEXT,sales_start_at TEXT,created_at TEXT)');
$pdo->exec('CREATE TABLE inventory_equipment_edits(id TEXT,store_id TEXT,before_json TEXT,after_json TEXT,created_by TEXT)');
function uuidv4(){return bin2hex(random_bytes(16));}
$pdo->prepare('INSERT INTO inventory_pos_links VALUES (?,?,?,?,?,?,?,?,?)')->execute(['link','cafe',$key,'CAKE','Cake','piece','POS-CAKE','2026-10-17 00:00:00','2026-10-18 10:00:00']);
$original=['store_id'=>'cafe','product_code'=>'CAKE','product_name'=>'Cake','unit'=>'piece'];
$next=['product_code'=>'NEW-CAKE','product_name'=>'New Cake','unit'=>'box'];
$pdo->beginTransaction();
pos_equipment_edit($original,$next,['id'=>'admin','role'=>'admin'],'2026-10-17',12,'Physical count');
$pdo->commit();
$renamed=$pdo->query('SELECT * FROM inventory_pos_links')->fetch();
check($renamed['product_code']==='NEW-CAKE'&&$renamed['pos_code']==='POS-CAKE','Rename retains POS mapping');
check(pos_linked_stock_balance($renamed,'2026-10-17')['quantity']===12.0,'Rename preserves inbound and applies exact target count');
check((float)$pdo->query("SELECT SUM(quantity) FROM inventory_receipt_items WHERE receipt_id IN ('old','new')")->fetchColumn()===25.0,'Stock edits never rewrite original receipt quantities');
check((int)$pdo->query('SELECT COUNT(*) FROM inventory_equipment_edits')->fetchColumn()===1,'Admin edit audited');
$renamedOriginal=$original;$renamedOriginal['product_code']='NEW-CAKE';$renamedOriginal['product_name']='New Cake';$renamedOriginal['unit']='box';
$pdo->beginTransaction();
pos_equipment_edit($renamedOriginal,$next,['id'=>'admin','role'=>'admin'],'2026-10-17',12,'Retry same count');
$pdo->commit();
check(pos_linked_stock_balance($renamed,'2026-10-17')['quantity']===12.0,'Repeated exact target count cannot double-adjust');
foreach ([['role'=>'server','qty'=>3,'reason'=>'Count'],['role'=>'admin','qty'=>-1,'reason'=>'Count'],['role'=>'admin','qty'=>3,'reason'=>'']] as $case) {
 $pdo->beginTransaction();$rejected=false;
 try{pos_equipment_edit($renamedOriginal,$next,['id'=>'test','role'=>$case['role']],'2026-10-17',$case['qty'],$case['reason']);}catch(InvalidArgumentException $e){$rejected=true;}
 $pdo->rollBack();check($rejected,'Reject unauthorized, negative or unaudited edit');
}
echo "PASS admin edits: rename continuity, target count, audit, repeated save, authorization and validation\n";

$pdo->exec("UPDATE bill_items SET quantity=20 WHERE bill_id='sale'");
$negative=pos_linked_stock_balance($renamed,'2026-10-17')['quantity'];
check($negative<0,'Fixture has a real stock deficit');
$pdo->beginTransaction();
$caseNext=['product_code'=>'NEW-CAKE','product_name'=>'New Cake','unit'=>'Box'];
pos_equipment_edit($renamedOriginal,$caseNext,['id'=>'admin','role'=>'admin'],'2026-10-17',null,'');
$pdo->commit();
$renamed=$pdo->query('SELECT * FROM inventory_pos_links')->fetch();
check(pos_linked_stock_balance($renamed,'2026-10-17')['quantity']===$negative,'Metadata edit preserves negative stock without forcing a count');
echo "PASS deficit metadata edits without changing stock\n";
