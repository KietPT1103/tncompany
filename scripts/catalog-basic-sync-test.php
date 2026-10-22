<?php
declare(strict_types=1);
require_once __DIR__ . '/../public/api/_lib/catalog_basic_sync.php';
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
function rejected(callable $fn, int $code): void {
    try { $fn(); } catch (DomainException $e) { check($e->getCode()===$code, $e->getMessage()); return; }
    throw new RuntimeException('Request should have been rejected');
}
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$admin = ['role'=>'admin'];
$data = [['product_code'=>'SP1','product_name'=>'Tên mới','price'=>89000],['product_code'=>'COMBO1','product_name'=>'Combo mới','price'=>0]];
rejected(fn()=>catalog_basic_sync($pdo,['role'=>'manager'],'restaurant',$data,false,null,fn()=>'new'),403);
$pdo->exec('CREATE TABLE products(id TEXT PRIMARY KEY,store_id TEXT,product_code TEXT COLLATE NOCASE,product_name TEXT,price REAL,cost REAL,has_cost INTEGER,is_selling INTEGER,stock_quantity REAL,item_type TEXT,category_id TEXT, UNIQUE(store_id,product_code))');
$pdo->exec("INSERT INTO products VALUES ('old','restaurant','SP1','Tên cũ',100000,42000,1,0,-3,'product','food'),('outside','cafe','SP1','Cafe',123,99,1,1,8,'product','drink'),('keep','restaurant','KEEP','Không có trong file',15,5,1,1,7,'product','food')");
$pdo->exec('CREATE TABLE product_ingredients(product_id TEXT,ingredient_id TEXT,quantity REAL)');
$pdo->exec("INSERT INTO product_ingredients VALUES ('old','NL1',2)");
$preview = catalog_basic_sync($pdo,$admin,'restaurant',$data,false,null,fn()=>'new');
check($preview['createdCount']===1 && $preview['updatedCount']===1,'Preview counts');
check((float)$pdo->query("SELECT price FROM products WHERE id='old'")->fetchColumn()===100000.0,'Preview is read only');
rejected(fn()=>catalog_basic_sync($pdo,$admin,'restaurant',[$data[0],$data[0]],false,null,fn()=>'new'),422);
rejected(fn()=>catalog_basic_sync($pdo,$admin,'restaurant',[['product_code'=>'BAD','product_name'=>'X','price'=>-1]],false,null,fn()=>'new'),422);
rejected(fn()=>catalog_basic_sync($pdo,$admin,'restaurant',[['product_code'=>'BAD','product_name'=>'X','price'=>'']],false,null,fn()=>'new'),422);
rejected(fn()=>catalog_basic_sync($pdo,$admin,'restaurant',$data,true,'stale',fn()=>'new'),409);
rejected(fn()=>catalog_basic_sync($pdo,['role'=>'server'],'restaurant',$data,true,$preview['previewToken'],fn()=>'new'),403);
// Stock movements after preview must survive the catalog update.
$pdo->exec("UPDATE products SET stock_quantity=-9 WHERE id='old'");
$result = catalog_basic_sync($pdo,$admin,'restaurant',$data,true,$preview['previewToken'],fn()=>'new');
check($result['createdCount']===1 && $result['updatedCount']===1,'Applied counts');
$row=$pdo->query("SELECT * FROM products WHERE id='old'")->fetch();
check($row['product_name']==='Tên mới' && (float)$row['price']===89000.0,'Only name and price updated');
check((float)$row['stock_quantity']===-9.0 && (float)$row['cost']===42000.0 && (int)$row['is_selling']===0 && $row['category_id']==='food','Concurrent stock movement, cost, status and category preserved');
check($row['id']==='old' && $row['product_code']==='SP1' && (int)$row['has_cost']===1,'Existing identity and cost configuration preserved');
check((float)$pdo->query('SELECT quantity FROM product_ingredients')->fetchColumn()===2.0,'Recipe preserved');
check((float)$pdo->query("SELECT price FROM products WHERE id='outside'")->fetchColumn()===123.0,'Other store preserved');
check((float)$pdo->query("SELECT stock_quantity FROM products WHERE id='keep'")->fetchColumn()===7.0,'Absent products preserved');
$pdo->exec("INSERT INTO products VALUES ('ingredient','restaurant','NL1','Nguyên liệu',100,50,1,0,12,'ingredient',NULL)");
$ingredientData=[['product_code'=>'NL1','product_name'=>'Không được ghi đè','price'=>1]];
$mixedData=[...$ingredientData,['product_code'=>'SP1','product_name'=>'Tên sau đồng bộ','price'=>95000]];
$mixedPreview=catalog_basic_sync($pdo,$admin,'restaurant',$mixedData,false,null,fn()=>'unused');
check($mixedPreview['skippedCount']===1 && $mixedPreview['updatedCount']===1,'Ingredient collision does not block valid products');
check($mixedPreview['rows'][0]['status']==='skipped','Preview explicitly identifies skipped ingredient');
catalog_basic_sync($pdo,$admin,'restaurant',$mixedData,true,$mixedPreview['previewToken'],fn()=>'unused');
check($pdo->query("SELECT product_name FROM products WHERE id='ingredient'")->fetchColumn()==='Nguyên liệu','Ingredient catalog cannot be overwritten');
check((float)$pdo->query("SELECT stock_quantity FROM products WHERE id='ingredient'")->fetchColumn()===12.0,'Skipped ingredient stock preserved');
check((float)$pdo->query("SELECT price FROM products WHERE id='ingredient'")->fetchColumn()===100.0,'Skipped ingredient price preserved');
check((float)$pdo->query("SELECT price FROM products WHERE id='old'")->fetchColumn()===95000.0,'Valid product sync continues alongside skipped ingredient');
$ingredientPreview=catalog_basic_sync($pdo,$admin,'restaurant',$ingredientData,false,null,fn()=>'unused');
$pdo->exec("UPDATE products SET item_type='product' WHERE id='ingredient'");
rejected(fn()=>catalog_basic_sync($pdo,$admin,'restaurant',$ingredientData,true,$ingredientPreview['previewToken'],fn()=>'unused'),409);
$pdo->exec("UPDATE products SET item_type='ingredient' WHERE id='ingredient'");
// Restore product values before checking repeat imports.
$pdo->exec("UPDATE products SET product_name='Tên mới',price=89000 WHERE id='old'");
$again=catalog_basic_sync($pdo,$admin,'restaurant',$data,false,null,fn()=>'unused');
check($again['unchangedCount']===2,'Repeat import is idempotent');
$pdo->exec("UPDATE products SET price=1 WHERE id='old'");
rejected(fn()=>catalog_basic_sync($pdo,$admin,'restaurant',$data,true,$again['previewToken'],fn()=>'unused'),409);
$newData=[['product_code'=>'NEW2','product_name'=>'X','price'=>10],['product_code'=>'NEW3','product_name'=>'Y','price'=>20]];
$newPreview=catalog_basic_sync($pdo,$admin,'restaurant',$newData,false,null,fn()=>'same-id');
try { catalog_basic_sync($pdo,$admin,'restaurant',$newData,true,$newPreview['previewToken'],fn()=>'same-id'); throw new LogicException('Expected duplicate id'); } catch (PDOException $e) {}
check((int)$pdo->query("SELECT COUNT(*) FROM products WHERE product_code IN ('NEW2','NEW3')")->fetchColumn()===0,'Whole import rolls back on failure');
echo "PASS preview, validation, admin access, three-field sync, preservation, stale preview and transaction rollback\n";
