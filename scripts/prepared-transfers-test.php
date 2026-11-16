<?php
declare(strict_types=1);
require_once __DIR__ . '/../public/api/_lib/prepared_transfers.php';
function uuidv4(): string { return bin2hex(random_bytes(16)); }
function check(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
function rejects(callable $fn): void { try { $fn(); } catch (Throwable $e) { return; } throw new RuntimeException('Expected rejection'); }
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->sqliteCreateFunction('NOW', fn()=> '2026-11-16 10:00:00');
$pdo->exec('CREATE TABLE ingredients(id TEXT,store_id TEXT,ingredient_code TEXT,ingredient_name TEXT,unit TEXT,base_unit TEXT,is_active INTEGER,preparation_stock_quantity REAL,updated_at TEXT)');
$pdo->exec("INSERT INTO ingredients VALUES ('a','cafe','NL1','Cốt trà','ml','ml',1,100,NULL),('b','bar','NL1','Cốt trà','ml','ml',1,20,NULL)");
$pdo->exec("CREATE TABLE ingredient_components(parent_ingredient_id TEXT); INSERT INTO ingredient_components VALUES ('a'),('b')");
$pdo->exec('CREATE TABLE inventory_prepared_transfers(id TEXT,source_store_id TEXT,destination_store_id TEXT,source_ingredient_id TEXT,destination_ingredient_id TEXT,ingredient_code TEXT,ingredient_name TEXT,unit TEXT,quantity REAL,source_before REAL,source_after REAL,destination_before REAL,destination_after REAL,actor TEXT,note TEXT)');
$body=['ingredientId'=>'a','quantity'=>25.125,'expectedStock'=>100,'note'=>'Ca chiều'];
foreach ([-1,0,'oops',INF,0.0001,101] as $bad) rejects(fn()=>prepared_transfer($pdo,'cafe','bar','Admin',array_replace($body,['quantity'=>$bad])));
rejects(fn()=>prepared_transfer($pdo,'cafe','cafe','Admin',$body));
rejects(fn()=>prepared_transfer($pdo,'cafe','missing','Admin',$body));
$pdo->exec("UPDATE ingredients SET base_unit='g' WHERE id='b'");
rejects(fn()=>prepared_transfer($pdo,'cafe','bar','Admin',$body));
$pdo->exec("UPDATE ingredients SET base_unit='ml' WHERE id='b'");
prepared_transfer($pdo,'cafe','bar','Admin',$body);
check((float)$pdo->query("SELECT preparation_stock_quantity FROM ingredients WHERE id='a'")->fetchColumn()===74.875,'deducts source');
check((float)$pdo->query("SELECT preparation_stock_quantity FROM ingredients WHERE id='b'")->fetchColumn()===45.125,'adds destination');
$audit=$pdo->query('SELECT * FROM inventory_prepared_transfers')->fetch();
check($audit['actor']==='Admin' && $audit['note']==='Ca chiều' && (float)$audit['source_before']===100.0 && (float)$audit['destination_after']===45.125,'audits actor, note, balances');
rejects(fn()=>prepared_transfer($pdo,'cafe','bar','Admin',$body));
$pdo->exec("CREATE TRIGGER audit_failure BEFORE INSERT ON inventory_prepared_transfers BEGIN SELECT RAISE(ABORT,'audit failure'); END");
rejects(fn()=>prepared_transfer($pdo,'cafe','bar','Admin',array_replace($body,['expectedStock'=>74.875])));
check((float)$pdo->query("SELECT preparation_stock_quantity FROM ingredients WHERE id='a'")->fetchColumn()===74.875,'audit failure rolls back stock');
check((int)$pdo->query('SELECT COUNT(*) FROM inventory_prepared_transfers')->fetchColumn()===1,'rejects stale retry and partial audits');
echo "PASS prepared transfers: balances, validation, units, stale stock, audit and rollback\n";
