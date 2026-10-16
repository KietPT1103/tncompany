<?php
declare(strict_types=1);
require_once __DIR__.'/_lib/bootstrap.php';
require_once __DIR__.'/_lib/field_inventory.php';
require_once __DIR__.'/_lib/pos_linked_stock.php';
$user=auth_require_permission(['inventory_stock.view','inventory_receipts.view','bills.access','bar.checkout']);
$method=$_SERVER['REQUEST_METHOD']??'GET';
$body=$method==='POST'?read_json_body():[];
$store=field_inventory_require_store($user,trim((string)($body['storeId']??$_GET['storeId']??'')));
pos_linked_stock_ensure();
if($method==='POST') {
 if(!field_inventory_is_admin($user)) respond_error('Chỉ admin được liên kết sản phẩm POS.',403);
 $code=trim((string)($body['productCode']??''));$name=trim((string)($body['productName']??''));$unit=trim((string)($body['unit']??''));$pos=trim((string)($body['posCode']??''));
 $q=db()->prepare('SELECT 1 FROM inventory_receipt_items i JOIN inventory_receipts r ON r.id=i.receipt_id WHERE r.store_id=:store AND i.item_type="equipment" AND i.product_code=:code AND i.product_name=:name AND i.unit=:unit LIMIT 1');
 $q->execute(['store'=>$store,'code'=>$code,'name'=>$name,'unit'=>$unit]);if(!$q->fetchColumn())respond_error('Không tìm thấy hàng trong kho.',422);
 $q=db()->prepare('SELECT 1 FROM products WHERE store_id=:store AND product_code=:pos LIMIT 1');$q->execute(['store'=>$store,'pos'=>$pos]);if(!$q->fetchColumn())respond_error('Sản phẩm POS không thuộc cửa hàng.',422);
 try{db()->prepare('INSERT INTO inventory_pos_links(id,store_id,stock_key,product_code,product_name,unit,pos_code,created_by) VALUES (:id,:store,:key,:code,:name,:unit,:pos,:actor)')->execute(['id'=>uuidv4(),'store'=>$store,'key'=>hash('sha256',json_encode([$code,$name,$unit])),'code'=>$code,'name'=>$name,'unit'=>$unit,'pos'=>$pos,'actor'=>$user['id']]);}
 catch(PDOException $e){if((int)($e->errorInfo[1]??0)===1062)respond_error('Mặt hàng hoặc sản phẩm POS đã được liên kết. Không đổi liên kết sau khi bắt đầu tính tồn.',409);throw $e;}
 respond_ok(['linked'=>true]);
}
if($method!=='GET')respond_error('Method not allowed',405);
$date=(string)($_GET['date']??(new DateTimeImmutable('now',new DateTimeZone('Asia/Ho_Chi_Minh')))->format('Y-m-d'));
$parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date);if(!$parsed||$parsed->format('Y-m-d')!==$date)respond_error('Ngày không hợp lệ.',422);
$q=db()->prepare('SELECT * FROM inventory_pos_links WHERE store_id=:store');$q->execute(['store'=>$store]);$items=[];
foreach($q->fetchAll() as $link)$items[]=array_merge(['productCode'=>$link['product_code'],'productName'=>$link['product_name'],'unit'=>$link['unit']],pos_linked_stock_balance($link,$date));
$products=[];if(field_inventory_is_admin($user)){$q=db()->prepare('SELECT product_code code,product_name name FROM products WHERE store_id=:store ORDER BY product_name');$q->execute(['store'=>$store]);$products=$q->fetchAll();}
respond_ok(['items'=>$items,'products'=>$products,'date'=>$date]);
