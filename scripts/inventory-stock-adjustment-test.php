<?php
declare(strict_types=1);
require_once __DIR__ . '/../public/api/_lib/inventory_stock_adjustment.php';
function uuidv4(): string { return bin2hex(random_bytes(16)); }
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
function rejects(callable $fn): void { try { $fn(); } catch (RuntimeException $e) { return; } throw new RuntimeException('Expected rejection'); }
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->sqliteCreateFunction('NOW', fn()=> '2026-10-20 10:00:00');
$pdo->exec('CREATE TABLE ingredients(id TEXT,store_id TEXT,ingredient_code TEXT,ingredient_name TEXT,stock_quantity REAL,purchase_to_base_factor REAL,cost REAL,updated_at TEXT)');
$pdo->exec("INSERT INTO ingredients VALUES('salt','cafe','NL104','Milkfoam',5000,1000,95,NULL)");
$pdo->exec('CREATE TABLE inventory_checks(id TEXT,store_id TEXT,check_code TEXT,check_date TEXT,status TEXT,note TEXT,counted_item_count INTEGER,total_actual_quantity REAL,total_variance_quantity REAL,increase_quantity_total REAL,decrease_quantity_total REAL,variance_value_total REAL,completed_at TEXT,completed_by TEXT,created_by TEXT)');
$pdo->exec('CREATE TABLE inventory_check_items(check_id TEXT,product_id TEXT,ingredient_id TEXT,product_code TEXT,product_name TEXT,system_quantity REAL,is_counted INTEGER,actual_quantity REAL,variance_quantity REAL,unit_cost REAL NOT NULL,variance_value REAL,note TEXT)');
$body=['ingredientId'=>'salt','expectedStock'=>5000,'quantity'=>0,'reason'=>'Correct missing deduction'];
rejects(fn()=> inventory_stock_adjust($pdo,'manager','cafe','Admin',$body));
rejects(fn()=> inventory_stock_adjust($pdo,'admin','other','Admin',$body));
rejects(fn()=> inventory_stock_adjust($pdo,'admin','cafe','Admin',array_replace($body,['reason'=>' '])));
foreach ([-1,'oops',INF] as $bad) rejects(fn()=>inventory_stock_adjust($pdo,'admin','cafe','Admin',array_replace($body,['quantity'=>$bad])));
rejects(fn()=> inventory_stock_adjust($pdo,'admin','cafe','Admin',array_replace($body,['expectedStock'=>4000])));
$id=inventory_stock_adjust($pdo,'admin','cafe','Admin',$body);
check((float)$pdo->query('SELECT stock_quantity FROM ingredients')->fetchColumn()===0.0,'sets stock to zero');
$audit=$pdo->query('SELECT * FROM inventory_check_items')->fetch();
check((float)$audit['system_quantity']===5000.0 && (float)$audit['actual_quantity']===0.0 && (float)$audit['variance_quantity']===-5000.0,'audits before, after and difference');
check($pdo->query('SELECT created_by FROM inventory_checks')->fetchColumn()==='Admin','audits actor');
$header=$pdo->query('SELECT * FROM inventory_checks')->fetch();
check($header['note']==='Correct missing deduction' && $header['completed_at']==='2026-10-20 10:00:00' && $header['status']==='completed','audits reason and completion time');
rejects(fn()=> inventory_stock_adjust($pdo,'admin','cafe','Admin',$body));
check((int)$pdo->query('SELECT COUNT(*) FROM inventory_checks')->fetchColumn()===1,'stale retry never creates duplicate audit');
inventory_stock_adjust($pdo,'admin','cafe','Admin',array_replace($body,['expectedStock'=>0,'quantity'=>2.5]));
check((float)$pdo->query('SELECT stock_quantity FROM ingredients')->fetchColumn()===2500.0,'converts purchase unit to base unit');
$pdo->exec("UPDATE ingredients SET cost=NULL WHERE id='salt'");
inventory_stock_adjust($pdo,'admin','cafe','Admin',array_replace($body,['expectedStock'=>2500,'quantity'=>3]));
check((float)$pdo->query('SELECT unit_cost FROM inventory_check_items ORDER BY rowid DESC LIMIT 1')->fetchColumn()===0.0,'missing cost is audited as zero');
$pdo->exec("CREATE TRIGGER audit_failure BEFORE INSERT ON inventory_check_items BEGIN SELECT RAISE(ABORT,'audit failure'); END");
try { inventory_stock_adjust($pdo,'admin','cafe','Admin',array_replace($body,['expectedStock'=>3000,'quantity'=>1])); } catch (Throwable $e) {}
check((float)$pdo->query('SELECT stock_quantity FROM ingredients')->fetchColumn()===3000.0 && (int)$pdo->query('SELECT COUNT(*) FROM inventory_checks')->fetchColumn()===3,'audit failure rolls back all changes');
echo "PASS stock adjustment: role, reason, validation, stale stock, units, audit, rollback\n";
