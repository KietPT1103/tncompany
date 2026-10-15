<?php
declare(strict_types=1);
require_once __DIR__ . '/../public/api/_lib/reset_kitchen_product_stock.php';

function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
foreach (['manager', 'user', 'server', 'bartender', ''] as $role) {
    try { reset_kitchen_product_stock($pdo, ['role' => $role], 'restaurant'); throw new LogicException('Non-admin accepted'); }
    catch (DomainException $exception) { check($exception->getCode() === 403, 'Non-admin must be forbidden'); }
}
try { reset_kitchen_product_stock($pdo, ['role'=>'admin'], 'cafe'); throw new LogicException('Other store accepted'); }
catch (DomainException $exception) { check($exception->getCode() === 422, 'Other store must be rejected'); }

$pdo->exec('CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT)');
$pdo->exec('CREATE TABLE products (id TEXT PRIMARY KEY,store_id TEXT,item_type TEXT,category_id TEXT,stock_quantity REAL,price REAL,cost REAL)');
$pdo->exec("INSERT INTO categories VALUES ('ingredients','Nguyên liệu')");
$pdo->exec("INSERT INTO products VALUES
 ('kitchen','restaurant','product',NULL,12,100,40),
 ('negative','restaurant','product',NULL,-5,100,40),
 ('zero','restaurant','product',NULL,0,100,40),
 ('cafe','cafe','product',NULL,9,100,40),
 ('ingredient','restaurant','ingredient',NULL,22,100,40),
 ('legacy-ingredient','restaurant','product','ingredients',33,100,40)");
$pdo->exec('CREATE TABLE ingredients (stock_quantity REAL, preparation_stock_quantity REAL)');
$pdo->exec('INSERT INTO ingredients VALUES (50,25)');
$changed = reset_kitchen_product_stock($pdo, ['role'=>'admin'], 'restaurant');
check($changed === 2, 'Only nonzero kitchen products change');
$stock = $pdo->query('SELECT id,stock_quantity FROM products')->fetchAll(PDO::FETCH_KEY_PAIR);
check((float)$stock['kitchen'] === 0.0 && (float)$stock['negative'] === 0.0, 'Kitchen product stock resets');
check((float)$stock['cafe'] === 9.0, 'Other stores unchanged');
check((float)$stock['ingredient'] === 22.0 && (float)$stock['legacy-ingredient'] === 33.0, 'Ingredient records unchanged');
check((float)$pdo->query('SELECT stock_quantity FROM ingredients')->fetchColumn() === 50.0, 'Ingredient stock unchanged');
check((float)$pdo->query('SELECT preparation_stock_quantity FROM ingredients')->fetchColumn() === 25.0, 'Preparation stock unchanged');
check((float)$pdo->query("SELECT price FROM products WHERE id='kitchen'")->fetchColumn() === 100.0, 'Price unchanged');
check(reset_kitchen_product_stock($pdo, ['role'=>'admin'], 'restaurant') === 0, 'Repeated reset has no effect');
echo "PASS admin-only kitchen product stock reset and scope isolation\n";
