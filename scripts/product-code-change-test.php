<?php
declare(strict_types=1);
require_once __DIR__ . '/../public/api/_lib/product_code_change.php';

function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
function rejected(callable $action, int $code): void {
    try { $action(); } catch (DomainException $error) { check($error->getCode() === $code, 'Expected error status'); return; }
    throw new RuntimeException('Invalid code was accepted');
}
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE TABLE products (id TEXT PRIMARY KEY, store_id TEXT, product_code TEXT COLLATE NOCASE, stock_quantity REAL, UNIQUE(store_id,product_code))');
$pdo->exec("INSERT INTO products VALUES ('one','restaurant','OLD',12),('two','restaurant','USED',5),('cafe','cafe','SHARED',9)");
$pdo->exec('CREATE TABLE product_ingredients (product_id TEXT, ingredient_id TEXT, quantity REAL)');
$pdo->exec("INSERT INTO product_ingredients VALUES ('one','NL1',2)");
rejected(fn()=>products_change_code($pdo,'restaurant','one',''),422);
rejected(fn()=>products_change_code($pdo,'restaurant','one',str_repeat('X',101)),422);
rejected(fn()=>products_change_code($pdo,'restaurant','one',"BAD\nCODE"),422);
rejected(fn()=>products_change_code($pdo,'restaurant','one','used'),409);
rejected(fn()=>products_change_code($pdo,'cafe','one','NEW'),404);
check(products_change_code($pdo,'restaurant','one',' OLD ') === 'OLD', 'Current code accepted');
check(products_change_code($pdo,'restaurant','one',' NEW-01 ') === 'NEW-01', 'Code trimmed');
check($pdo->query("SELECT product_code FROM products WHERE id='one'")->fetchColumn()==='NEW-01','Code updated');
check((float)$pdo->query("SELECT stock_quantity FROM products WHERE id='one'")->fetchColumn()===12.0,'Stock preserved');
check($pdo->query('SELECT product_id FROM product_ingredients')->fetchColumn()==='one','Recipe links preserved');
check(products_change_code($pdo,'restaurant','one','SHARED')==='SHARED','Codes scoped to store');
$pdo->beginTransaction();
products_change_code($pdo,'restaurant','one','ROLLBACK');
$pdo->rollBack();
check($pdo->query("SELECT product_code FROM products WHERE id='one'")->fetchColumn()==='SHARED','Participates in parent transaction');
echo "PASS product code validation, uniqueness, store isolation, recipe links and rollback\n";
