<?php
declare(strict_types=1);

require_once __DIR__ . '/../public/api/_lib/catalog_basic_sync.php';

$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
function db(): PDO { global $pdo; return $pdo; }
function check(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }

// Execute the production POS functions without bootstrapping an HTTP endpoint.
$source = file_get_contents(__DIR__ . '/../public/api/pos.php');
foreach ([['pos_filter_preparation_print_items', 'pos_shift_payload'], ['pos_replace_bill_children', 'pos_job_items']] as [$first, $next]) {
    $start = strpos($source, 'function ' . $first . '(');
    $end = strpos($source, 'function ' . $next . '(', $start);
    check($start !== false && $end !== false, 'Production POS functions must be present');
    eval(substr($source, $start, $end - $start));
}

$pdo->exec('CREATE TABLE products(id TEXT PRIMARY KEY,store_id TEXT,product_code TEXT,product_name TEXT,price REAL,cost REAL,has_cost INTEGER,is_selling INTEGER,stock_quantity REAL,item_type TEXT,category_id TEXT,UNIQUE(store_id,product_code))');
$pdo->exec('CREATE TABLE categories(id TEXT PRIMARY KEY,counts_as_cup INTEGER,is_preparation_print_enabled INTEGER)');
$pdo->exec("INSERT INTO categories VALUES ('kitchen',1,1),('no-print',0,0)");
$pdo->exec("INSERT INTO products VALUES ('food','restaurant','SP1','Old name',100,40,1,1,20,'product','kitchen'),('stopped','restaurant','SP2','Stopped',100,40,1,0,8,'product','no-print'),('ingredient','restaurant','NL1','Ingredient',5,2,1,0,12,'ingredient',NULL)");
$pdo->exec('CREATE TABLE bills(id TEXT PRIMARY KEY,store_id TEXT,status TEXT,total REAL)');
$pdo->exec('CREATE TABLE bill_items(id INTEGER PRIMARY KEY,bill_id TEXT,menu_id TEXT,name TEXT,price REAL,quantity REAL,line_total REAL,note TEXT,base_price REAL,surcharge_per_unit REAL,surcharge_total REAL,counts_as_cup INTEGER)');
$pdo->exec('CREATE TABLE bill_surcharges(bill_id TEXT,surcharge_ref_id TEXT,name TEXT,surcharge_type TEXT,value REAL,amount REAL)');
$pdo->exec("INSERT INTO bills VALUES ('paid','restaurant','completed',200)");
$pdo->exec("INSERT INTO bill_items(bill_id,menu_id,name,price,quantity,line_total,counts_as_cup) VALUES ('paid','SP1','Old name',100,2,200,1)");
$pdo->exec('CREATE TABLE live_orders(id TEXT PRIMARY KEY,store_id TEXT,order_key TEXT,status TEXT)');
$pdo->exec('CREATE TABLE live_order_items(live_order_id TEXT,menu_id TEXT,name TEXT,price REAL,quantity REAL,note TEXT,category TEXT)');
$pdo->exec("INSERT INTO live_orders VALUES ('open','restaurant','Table 1','open')");
$pdo->exec("INSERT INTO live_order_items VALUES ('open','SP1','Old name',100,3,'No ice','Kitchen')");
$pdo->exec('CREATE TABLE product_ingredients(product_id TEXT,ingredient_id TEXT,quantity REAL)');
$pdo->exec("INSERT INTO product_ingredients VALUES ('food','ingredient',2)");

function snapshot(string $table): array { return db()->query('SELECT * FROM ' . $table . ' ORDER BY rowid')->fetchAll(); }
$tables = ['bills','bill_items','bill_surcharges','live_orders','live_order_items','product_ingredients','categories'];
$before = [];
foreach ($tables as $table) $before[$table] = snapshot($table);
$items = [
    ['product_code'=>'SP1','product_name'=>'New name','price'=>150],
    ['product_code'=>'SP2','product_name'=>'Stopped renamed','price'=>250],
    ['product_code'=>'NL1','product_name'=>'Do not overwrite','price'=>900],
];
$preview = catalog_basic_sync($pdo,['role'=>'admin'],'restaurant',$items,false,null,fn()=>'unused');
$result = catalog_basic_sync($pdo,['role'=>'admin'],'restaurant',$items,true,$preview['previewToken'],fn()=>'unused');
check($result['updatedCount']===2 && $result['skippedCount']===1,'Sync updates products and skips ingredient');
foreach ($tables as $table) check(snapshot($table)===$before[$table], 'Sync must preserve ' . $table);
$food = $pdo->query("SELECT * FROM products WHERE id='food'")->fetch();
check($food['product_code']==='SP1' && $food['product_name']==='New name' && (float)$food['price']===150.0,'POS menu identity is stable and receives requested name/price');
check((float)$food['stock_quantity']===20.0 && $food['category_id']==='kitchen','Stock and print category preserved');
check((int)$pdo->query("SELECT is_selling FROM products WHERE id='stopped'")->fetchColumn()===0,'Paused product stays paused');

// An open order retains its captured price when saved after a catalog price change.
$open = $pdo->query("SELECT menu_id AS menuId,name,price,quantity,note FROM live_order_items WHERE live_order_id='open'")->fetchAll();
foreach ($open as &$item) $item['lineTotal'] = (float)$item['price'] * (float)$item['quantity'];
unset($item);
pos_replace_bill_children('from-open','restaurant',$open,[]);
$saved = $pdo->query("SELECT * FROM bill_items WHERE bill_id='from-open'")->fetch();
check($saved['menu_id']==='SP1' && (float)$saved['price']===100.0 && (float)$saved['line_total']===300.0,'Existing open order keeps captured price');
check((int)$saved['counts_as_cup']===1,'POS retains category cup behavior');

// A newly selected item can be saved with the updated catalog price.
pos_replace_bill_children('new-order','restaurant',[['menuId'=>$food['product_code'],'name'=>$food['product_name'],'price'=>(float)$food['price'],'quantity'=>2,'lineTotal'=>(float)$food['price']*2]],[]);
$saved = $pdo->query("SELECT * FROM bill_items WHERE bill_id='new-order'")->fetch();
check($saved['menu_id']==='SP1' && (float)$saved['price']===150.0 && (float)$saved['line_total']===300.0,'New POS order saves updated price under original menu code');
$printItems = pos_filter_preparation_print_items('restaurant',[['menuId'=>'SP1'],['menuId'=>'SP2']]);
check($printItems===[['menuId'=>'SP1']],'Existing preparation print settings still apply');

echo "PASS catalog sync with production POS functions: paid bills, open orders, captured/new prices, menu identity, paused items, stock, recipes, cup flags and preparation print routing\n";
