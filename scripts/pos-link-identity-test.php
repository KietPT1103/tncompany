<?php
declare(strict_types=1);
require_once __DIR__.'/../public/api/_lib/pos_linked_stock.php';
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
function db(){global $pdo;return $pdo;}
function check($condition,$message){if(!$condition)throw new RuntimeException($message);}
$pdo->exec('CREATE TABLE inventory_pos_links (id TEXT,store_id TEXT,stock_key TEXT,product_code TEXT COLLATE NOCASE,product_name TEXT COLLATE NOCASE,unit TEXT COLLATE NOCASE,pos_code TEXT)');
$pdo->exec('CREATE TABLE inventory_receipts (id TEXT,store_id TEXT,status TEXT,previous_status TEXT,receipt_date TEXT)');
$pdo->exec('CREATE TABLE inventory_receipt_items (receipt_id TEXT,product_code TEXT COLLATE NOCASE,product_name TEXT COLLATE NOCASE,unit TEXT COLLATE NOCASE,item_type TEXT,quantity REAL,unit_cost REAL)');
$pdo->exec("INSERT INTO inventory_receipts VALUES ('r','cafe','completed',NULL,'2026-10-18')");
$pdo->exec("INSERT INTO inventory_receipt_items VALUES ('r','SP000163','Cake','cái','equipment',18,22000),('r','SP000164','Other cake','cái','equipment',17,18000)");
$pdo->prepare('INSERT INTO inventory_pos_links VALUES (?,?,?,?,?,?,?)')->execute(['link','cafe',pos_stock_key(['product_code'=>'SP000163','product_name'=>'Cake','unit'=>'Cái']),'SP000163','Cake','Cái','POS-CAKE']);
// Execute the stock endpoint query: its row must match the link payload exactly.
$source=file_get_contents(__DIR__.'/../public/api/inventory-equipment-stock.php');
preg_match("/prepare\\('(.+?)'\\);/s",$source,$match);
$q=$pdo->prepare($match[1]);$q->execute(['store'=>'cafe','date'=>'2026-10-19']);$rows=$q->fetchAll();
$linked=array_values(array_filter($rows,fn($r)=>$r['productCode']==='SP000163'))[0];
check($linked['unit']==='Cái','Linked stock identity must use stored link casing, so UI recognizes the existing link');
check((float)$linked['quantity']===18.0,'Linked incoming quantity remains intact');
$unlinked=array_values(array_filter($rows,fn($r)=>$r['productCode']==='SP000164'))[0];
check($unlinked['unit']==='cái','Unlinked identity remains intact');
check(pos_stock_find_link('cafe',['product_code'=>'sp000163','product_name'=>'cake','unit'=>'cái'])['id']==='link','Case variants must find the existing link rather than insert a duplicate');
check(pos_stock_find_link('other',['product_code'=>'SP000163','product_name'=>'Cake','unit'=>'Cái'])===null,'Links must remain store isolated');
check(pos_stock_find_link('cafe',['product_code'=>'SP000164','product_name'=>'Other cake','unit'=>'cái'])===null,'Different items must not take an existing link');
echo "PASS POS link identity: case variants, stock display, no duplicate insert, store/item isolation\n";
