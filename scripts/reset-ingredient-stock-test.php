<?php
declare(strict_types=1);
require_once __DIR__ . '/../public/api/_lib/reset_ingredient_stock.php';
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
foreach (['manager','server','user','bartender',''] as $role) {
    try { reset_ingredient_stock($pdo,['role'=>$role],'restaurant'); throw new RuntimeException('Non-admin accepted'); }
    catch (DomainException $error) { check($error->getCode()===403,'Forbidden status'); }
}
try { reset_ingredient_stock($pdo,['role'=>'admin'],'invalid'); throw new RuntimeException('Invalid store accepted'); }
catch (DomainException $error) { check($error->getCode()===422,'Invalid store status'); }
foreach (['cafe','bakery','farm','warehouse'] as $store) {
    try { reset_ingredient_stock($pdo,['role'=>'admin'],$store); throw new RuntimeException('Non-kitchen store accepted'); }
    catch (DomainException $error) { check($error->getCode()===422,'Only kitchen store is allowed'); }
}
$pdo->exec('CREATE TABLE ingredients (id TEXT,store_id TEXT,stock_quantity REAL,preparation_stock_quantity REAL,cost REAL,is_active INTEGER)');
$pdo->exec("INSERT INTO ingredients VALUES ('one','restaurant',10,3,50,1),('negative','restaurant',-2,4,60,1),('hidden','restaurant',9,5,70,0),('cafe','cafe',8,6,80,1)");
$pdo->exec('CREATE TABLE products(stock_quantity REAL)');
$pdo->exec('INSERT INTO products VALUES (12)');
check(reset_ingredient_stock($pdo,['role'=>'admin'],'restaurant')===3,'Reset all rows in selected store including hidden and negative stock');
check((int)$pdo->query("SELECT COUNT(*) FROM ingredients WHERE store_id='restaurant' AND stock_quantity<>0")->fetchColumn()===0,'Current stock is zero');
check((float)$pdo->query("SELECT stock_quantity FROM ingredients WHERE id='cafe'")->fetchColumn()===8.0,'Other area preserved');
check((float)$pdo->query("SELECT preparation_stock_quantity FROM ingredients WHERE id='one'")->fetchColumn()===3.0,'Preparation stock preserved');
check((float)$pdo->query("SELECT cost FROM ingredients WHERE id='one'")->fetchColumn()===50.0,'Cost preserved');
check((float)$pdo->query('SELECT stock_quantity FROM products')->fetchColumn()===12.0,'Product stock preserved');
check(reset_ingredient_stock($pdo,['role'=>'admin'],'restaurant')===0,'Repeated reset is safe');
echo "PASS ingredient stock reset, admin authorization and scope isolation\n";
