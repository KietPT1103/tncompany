<?php
declare(strict_types=1);
require_once __DIR__.'/_lib/bootstrap.php';
require_once __DIR__.'/_lib/field_inventory.php';
require_once __DIR__.'/_lib/pos_linked_stock.php';
$user=auth_require_permission(['inventory_stock.view','inventory_receipts.view','bills.access','bar.checkout']);
$method=$_SERVER['REQUEST_METHOD']??'GET';
$body=in_array($method,['POST','PATCH'],true)?read_json_body():[];
$store=field_inventory_require_store($user,trim((string)($body['storeId']??$_GET['storeId']??'')));
pos_linked_stock_ensure();
$today=(new DateTimeImmutable('now',new DateTimeZone('Asia/Ho_Chi_Minh')))->format('Y-m-d');
if(in_array($method,['POST','PATCH'],true)) {
 if(!field_inventory_is_admin($user)) respond_error('Chỉ admin được sửa hàng tồn và liên kết POS.',403);
 $original=['store_id'=>$store,'product_code'=>trim((string)($body['productCode']??'')),'product_name'=>trim((string)($body['productName']??'')),'unit'=>trim((string)($body['unit']??''))];
 $lockName='equipment_edit_'.hash('sha256',$store);
 $lockName=substr($lockName,0,64);
 $q=db()->prepare('SELECT GET_LOCK(:name,10)');$q->execute(['name'=>$lockName]);
 if((int)$q->fetchColumn()!==1) respond_error('Kho đang được chỉnh sửa. Vui lòng thử lại.',503);
 try {
  db()->beginTransaction();
  if(($body['action']??'')==='edit-stock') {
   $date=pos_stock_date((string)($body['date']??$today));
   if($date>$today) throw new InvalidArgumentException('Không điều chỉnh tồn ở ngày tương lai.');
   $next=['product_code'=>trim((string)($body['newProductCode']??'')),'product_name'=>trim((string)($body['newProductName']??'')),'unit'=>trim((string)($body['newUnit']??''))];
   $quantity=null;
   if(array_key_exists('quantity',$body)) {
    if(!is_numeric($body['quantity'])) throw new InvalidArgumentException('Số lượng không hợp lệ.');
    $quantity=round((float)$body['quantity'],3);
   }
   pos_equipment_edit($original,$next,$user,$date,$quantity,trim((string)($body['reason']??'')));
  } else {
   $pos=trim((string)($body['posCode']??''));
   $start=pos_stock_date((string)($body['salesStartDate']??$today));
   if($start>$today) throw new InvalidArgumentException('Ngày tính bill không được ở tương lai.');
   $q=db()->prepare('SELECT 1 FROM inventory_receipt_items i JOIN inventory_receipts r ON r.id=i.receipt_id WHERE r.store_id=:store AND i.item_type="equipment" AND i.product_code=:code AND i.product_name=:name AND i.unit=:unit LIMIT 1');
   $q->execute(['store'=>$store,'code'=>$original['product_code'],'name'=>$original['product_name'],'unit'=>$original['unit']]);
   if(!$q->fetchColumn()) throw new InvalidArgumentException('Không tìm thấy hàng trong kho.');
   $q=db()->prepare('SELECT 1 FROM products WHERE store_id=:store AND product_code=:pos LIMIT 1');$q->execute(['store'=>$store,'pos'=>$pos]);
   if(!$q->fetchColumn()) throw new InvalidArgumentException('Sản phẩm POS không thuộc cửa hàng.');
   $key=pos_stock_key($original);
   $old=pos_stock_find_link($store,$original);
   if($old) {
    db()->prepare('UPDATE inventory_pos_links SET pos_code=:pos,sales_start_at=:start WHERE id=:id AND store_id=:store')->execute(['pos'=>$pos,'start'=>$start.' 00:00:00','id'=>$old['id'],'store'=>$store]);
   } else {
    db()->prepare('INSERT INTO inventory_pos_links(id,store_id,stock_key,product_code,product_name,unit,pos_code,sales_start_at,created_by) VALUES (:id,:store,:key,:code,:name,:unit,:pos,:start,:actor)')->execute(['id'=>uuidv4(),'store'=>$store,'key'=>$key,'code'=>$original['product_code'],'name'=>$original['product_name'],'unit'=>$original['unit'],'pos'=>$pos,'start'=>$start.' 00:00:00','actor'=>$user['id']]);
   }
   db()->prepare('INSERT INTO inventory_equipment_edits(id,store_id,before_json,after_json,created_by) VALUES (:id,:store,:before,:after,:actor)')->execute(['id'=>uuidv4(),'store'=>$store,'before'=>json_encode($old?:$original),'after'=>json_encode($original+['posCode'=>$pos,'salesStartDate'=>$start]),'actor'=>$user['id']]);
  }
  db()->commit();
 } catch(Throwable $e) {
  if(db()->inTransaction()) db()->rollBack();
  if($e instanceof InvalidArgumentException) $error=$e->getMessage();
  elseif($e instanceof PDOException && (int)($e->errorInfo[1]??0)===1062) $error='Sản phẩm POS đã liên kết với hàng khác. Vui lòng chọn lại.';
  else throw $e;
 } finally {
  $q=db()->prepare('SELECT RELEASE_LOCK(:name)');$q->execute(['name'=>$lockName]);
 }
 if(isset($error)) respond_error($error,422);
 respond_ok(['saved'=>true]);
}
if($method!=='GET')respond_error('Method not allowed',405);
try {$date=pos_stock_date((string)($_GET['date']??$today));} catch(InvalidArgumentException $e){respond_error($e->getMessage(),422);}
$q=db()->prepare('SELECT * FROM inventory_pos_links WHERE store_id=:store');$q->execute(['store'=>$store]);$items=[];
foreach($q->fetchAll() as $link)$items[]=array_merge(['productCode'=>$link['product_code'],'productName'=>$link['product_name'],'unit'=>$link['unit']],pos_linked_stock_balance($link,$date));
$products=[];if(field_inventory_is_admin($user)){$q=db()->prepare('SELECT product_code code,product_name name FROM products WHERE store_id=:store ORDER BY product_name');$q->execute(['store'=>$store]);$products=$q->fetchAll();}
respond_ok(['items'=>$items,'products'=>$products,'date'=>$date]);
