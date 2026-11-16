<?php
declare(strict_types=1);
require_once __DIR__.'/../public/api/_lib/ingredient_copy.php';
function uuidv4(): string { return bin2hex(random_bytes(16)); }
function check(bool $ok,string $message):void { if (!$ok) throw new RuntimeException($message); }
function rejects(callable $fn):void { try {$fn();} catch(Throwable $e) {return;} throw new RuntimeException('Expected rejection'); }
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE ingredients(id TEXT PRIMARY KEY,store_id TEXT,ingredient_code TEXT,ingredient_name TEXT,normalized_name TEXT,unit TEXT,purchase_unit TEXT,base_unit TEXT,purchase_to_base_factor REAL,cost REAL,supplier_item_code TEXT,description TEXT,item_kind TEXT,conversion_input_quantity REAL,conversion_output_quantity REAL,supplier_id TEXT,conversion_source_ingredient_id TEXT,stock_quantity REAL,preparation_stock_quantity REAL,is_active INTEGER,UNIQUE(store_id,ingredient_code))');
$pdo->exec('CREATE TABLE ingredient_components(parent_ingredient_id TEXT,component_ingredient_id TEXT,input_quantity REAL)');
$pdo->exec("INSERT INTO ingredients (id,store_id,ingredient_code,ingredient_name,unit,base_unit,item_kind,stock_quantity,preparation_stock_quantity,is_active,cost,conversion_output_quantity,conversion_input_quantity,conversion_source_ingredient_id) VALUES ('raw','cafe','NL1','Trà','g','g','ingredient',100,0,1,2,NULL,NULL,NULL),('tea','cafe','NL2','Cốt trà','ml','ml','ingredient',0,500,1,0.2,1000,100,'raw')");
$pdo->exec("INSERT INTO ingredient_components VALUES ('tea','raw',100)");
$result=ingredient_copy_catalog($pdo,'cafe','bar',['tea','raw']);
check($result['createdCount']===2,'copies recipe and missing ingredient once');
$target=$pdo->query("SELECT * FROM ingredients WHERE store_id='bar' AND ingredient_code='NL2'")->fetch();
$raw=$pdo->query("SELECT * FROM ingredients WHERE store_id='bar' AND ingredient_code='NL1'")->fetch();
check($target['id']!=='tea' && $target['conversion_source_ingredient_id']===$raw['id'],'remaps legacy source');
$component=$pdo->query("SELECT * FROM ingredient_components WHERE parent_ingredient_id='".$target['id']."'")->fetch();
check($component['component_ingredient_id']===$raw['id'] && (float)$component['input_quantity']===100.0,'remaps recipe to target store');
check((float)$target['preparation_stock_quantity']===0.0 && (float)$raw['stock_quantity']===0.0,'starts with zero stock');
check((float)$target['cost']===0.2 && (float)$target['conversion_output_quantity']===1000.0,'preserves price and yield');
$pdo->exec("UPDATE ingredients SET stock_quantity=77 WHERE store_id='bar'");
$result=ingredient_copy_catalog($pdo,'cafe','bar',['tea','raw']);
check($result['createdCount']===0 && $result['skippedCount']===2,'repeated copy skips existing');
check((float)$pdo->query("SELECT stock_quantity FROM ingredients WHERE store_id='bar' LIMIT 1")->fetchColumn()===77.0,'preserves target stock');
rejects(fn()=>ingredient_copy_catalog($pdo,'cafe','cafe',['raw']));
rejects(fn()=>ingredient_copy_catalog($pdo,'cafe','bar',[]));
$pdo->exec("UPDATE ingredients SET base_unit='kg' WHERE store_id='bar' AND ingredient_code='NL1'");
rejects(fn()=>ingredient_copy_catalog($pdo,'cafe','bar',['raw']));
rejects(fn()=>ingredient_copy_catalog($pdo,'cafe','new',['tea','missing']));
check((int)$pdo->query("SELECT COUNT(*) FROM ingredients WHERE store_id='new'")->fetchColumn()===0,'rolls back whole batch on failure');
echo "PASS ingredient copy: dependencies, units, recipe, zero stock, duplicates and rollback\n";

// Exercise the same recipe resolver and snapshot capture used by POS checkout.
function db():PDO {global $pdo;return $pdo;}
function products_inventory_ensure_schema():void {}
$pdo->sqliteCreateCollation('utf8mb4_unicode_ci','strcasecmp');
$source=file_get_contents(__DIR__.'/../public/api/_lib/products_inventory.php');
foreach (['products_inventory_parse_decimal','products_inventory_normalize_sales_items','products_inventory_consumption_catalog','products_inventory_resolve_consumption_preview'] as $function) {
    $start=strpos($source,'function '.$function.'(');$end=strpos($source,"\nfunction ",$start+1);
    eval(substr($source,$start,$end===false?null:$end-$start));
}
require_once __DIR__.'/../public/api/_lib/ingredient_usage.php';
$pdo->exec('CREATE TABLE products(id TEXT,store_id TEXT,product_code TEXT,product_name TEXT,unit TEXT,cost REAL,stock_quantity REAL)');
$pdo->exec('CREATE TABLE product_ingredients(store_id TEXT,product_id TEXT,ingredient_id TEXT,quantity REAL)');
$pdo->exec('CREATE TABLE bills(id TEXT,store_id TEXT,status TEXT)');
$pdo->exec('CREATE TABLE bill_items(bill_id TEXT,menu_id TEXT,name TEXT)');
$pdo->exec('CREATE TABLE bill_recipe_snapshots(bill_id TEXT,menu_id TEXT,unit TEXT,recipe_json TEXT,snapshot_at TEXT,PRIMARY KEY(bill_id,menu_id))');
$pdo->exec("INSERT INTO products VALUES ('p','cafe','DRINK','Drink','ly',1,0),('p2','bar','DRINK','Drink','ly',1,0)");
$pdo->prepare('INSERT INTO product_ingredients VALUES (?,?,?,?)')->execute(['bar','p2',$target['id'],50]);
$pdo->exec("INSERT INTO product_ingredients VALUES ('cafe','p','tea',50)");
$pdo->exec("INSERT INTO bills VALUES ('old','cafe','completed'),('new','bar','completed'); INSERT INTO bill_items VALUES ('old','DRINK','Drink'),('new','DRINK','Drink')");
ingredient_usage_capture_bill('cafe','old',ingredient_usage_recipe_resolver());
$snapshot=$pdo->query("SELECT recipe_json FROM bill_recipe_snapshots WHERE bill_id='old'")->fetchColumn();
ingredient_copy_catalog($pdo,'cafe','third',['tea']);
ingredient_usage_capture_bill('cafe','old',ingredient_usage_recipe_resolver());
check($pdo->query("SELECT recipe_json FROM bill_recipe_snapshots WHERE bill_id='old'")->fetchColumn()===$snapshot,'copy preserves existing bill recipe');
$captured=ingredient_usage_capture_bill('bar','new',ingredient_usage_recipe_resolver());
$recipe=json_decode($pdo->query("SELECT recipe_json FROM bill_recipe_snapshots WHERE bill_id='new'")->fetchColumn(),true);
check($captured['saved']===1 && $captured['errors']===[],'copied recipe is compatible with POS bill capture');
check($recipe[0]['id']===$raw['id'] && (float)$recipe[0]['quantity']===5.0,'new bill resolves destination ingredient and correct quantity');
echo "PASS copy/POS integration: old snapshots preserved, new bills resolve destination recipe\n";
