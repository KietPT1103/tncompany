<?php
declare(strict_types=1);
require_once __DIR__.'/../public/api/_lib/product_duplicates.php';
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE products(id TEXT,store_id TEXT,product_code TEXT,product_name TEXT,normalized_name TEXT,item_type TEXT,unit TEXT)');
$pdo->exec("INSERT INTO products VALUES('p1','cafe','SP000001','Trà đào','tra dao','product','ly')");
function check(bool $ok,string $reason):void {if(!$ok)throw new RuntimeException($reason);}
check(products_find_create_duplicate($pdo,'new-cart','SP000002','product','tra dao','Trà đào')===null,'same name allowed in a different store');
check(products_find_create_duplicate($pdo,'cafe','SP000002','product','tra dao','TRÀ ĐÀO')['id']==='p1','same-store normalized duplicate remains blocked');
$pdo->exec("INSERT INTO products VALUES('legacy','cafe','SP000003','Legacy name',NULL,'product','ly')");
check(products_find_create_duplicate($pdo,'cafe','SP000004','product','legacy name',' LEGACY NAME ')['id']==='legacy','legacy unnormalized name remains blocked in same store');
check(products_find_create_duplicate($pdo,'new-cart','SP000004','product','legacy name','Legacy name')===null,'legacy name in another store allowed');
check(products_find_create_duplicate($pdo,'new-cart','sp000001','product','other','Other')['id']==='p1','existing global code rule preserved');
check(products_find_create_duplicate($pdo,'cafe','SP000005','ingredient','tra dao','Trà đào')===null,'item-type distinction preserved');
echo "PASS product duplicate scope: cross-store names allowed, local duplicates and code checks preserved\n";
