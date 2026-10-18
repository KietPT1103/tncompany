<?php
declare(strict_types=1);
function check(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
function products_inventory_ensure_schema(): void {}
$source = file_get_contents(__DIR__.'/../public/api/_lib/products_inventory.php');
foreach (['products_inventory_parse_decimal','products_inventory_normalize_sales_items','products_inventory_consumption_catalog','products_inventory_resolve_consumption_preview'] as $function) {
    $start = strpos($source, 'function '.$function.'(');
    check($start !== false, 'Missing reusable catalog resolver: '.$function);
    $end = strpos($source, "\nfunction ", $start + 1);
    eval(substr($source, $start, $end === false ? null : $end - $start));
}
$pdo = new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->sqliteCreateCollation('utf8mb4_unicode_ci', 'strcasecmp');
function db(): PDO { global $pdo; return $pdo; }
$pdo->exec('CREATE TABLE products(id TEXT,store_id TEXT,product_code TEXT,product_name TEXT,cost REAL,stock_quantity REAL)');
$pdo->exec('CREATE TABLE ingredients(id TEXT,ingredient_code TEXT,ingredient_name TEXT,base_unit TEXT,unit TEXT,cost REAL,preparation_stock_quantity REAL,item_kind TEXT,conversion_input_quantity REAL,conversion_output_quantity REAL,conversion_source_ingredient_id TEXT)');
$pdo->exec('CREATE TABLE product_ingredients(store_id TEXT,product_id TEXT,ingredient_id TEXT,quantity REAL)');
$pdo->exec('CREATE TABLE ingredient_components(parent_ingredient_id TEXT,component_ingredient_id TEXT,input_quantity REAL)');
$pdo->exec("INSERT INTO products VALUES('p1','cafe','CF','Coffee',0,0),('p2','cafe','TEA','Tea',0,0),('p3','restaurant','CF','Other',0,0)");
$pdo->exec("INSERT INTO ingredients VALUES('i1','NL1','Coffee beans','g','g',1,1000,'ingredient',NULL,NULL,NULL)");
$pdo->exec("INSERT INTO product_ingredients VALUES('cafe','p1','i1',20),('cafe','p2','i1',5)");
$catalog = products_inventory_consumption_catalog('cafe');
// A loaded catalog is sufficient for every dish, even when DB recipes have changed.
$pdo->exec('DELETE FROM product_ingredients');
$a = products_inventory_resolve_consumption_preview('cafe',[['productCode'=>'CF','quantity'=>3]],$catalog);
$b = products_inventory_resolve_consumption_preview('cafe',[['productCode'=>'TEA','quantity'=>4]],$catalog);
check($a['items'][0]['quantity'] === 60.0, 'Shared catalog resolves first dish without reloading');
check($b['items'][0]['quantity'] === 20.0, 'Shared catalog resolves another dish without reloading');
check($a['items'][0]['unit'] === 'g', 'Ingredient base unit retained');
check($a['errors'] === [] && $b['errors'] === [], 'Known recipes resolve');
$fresh = products_inventory_resolve_consumption_preview('cafe',[['productCode'=>'CF','quantity'=>3]]);
check(count($fresh['errors']) === 1, 'Existing preview callers still load fresh recipes');
echo "Ingredient usage catalog tests passed\n";