<?php
declare(strict_types=1);
require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/products_inventory.php';

products_inventory_ensure_schema();
ingredients_ensure_schema();
auth_ensure_column('inventory_issue_items', 'base_quantity', 'DECIMAL(15,3) NULL AFTER quantity');
db()->exec('CREATE TABLE IF NOT EXISTS inventory_counter_counts (id VARCHAR(64) PRIMARY KEY,store_id VARCHAR(32) NOT NULL,count_date DATE NOT NULL,note TEXT NULL,created_by VARCHAR(255) NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY idx_inventory_counter_counts_store_date (store_id,count_date)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
db()->exec('CREATE TABLE IF NOT EXISTS inventory_counter_count_items (id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,count_id VARCHAR(64) NOT NULL,ingredient_id VARCHAR(64) NOT NULL,actual_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,UNIQUE KEY uniq_inventory_counter_count_item (count_id,ingredient_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
db()->exec('CREATE TABLE IF NOT EXISTS preparation_receipts (id VARCHAR(64) PRIMARY KEY,store_id VARCHAR(32) NOT NULL,issue_id VARCHAR(64) NOT NULL,receipt_code VARCHAR(100) NOT NULL,receipt_date DATE NOT NULL,received_by VARCHAR(255) NOT NULL,note TEXT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uniq_preparation_receipt_issue (issue_id),UNIQUE KEY uniq_preparation_receipt_code (store_id,receipt_code),KEY idx_preparation_receipts_store_date (store_id,receipt_date)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
db()->exec('CREATE TABLE IF NOT EXISTS preparation_receipt_items (id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,receipt_id VARCHAR(64) NOT NULL,ingredient_id VARCHAR(64) NOT NULL,ingredient_code VARCHAR(100) NOT NULL,ingredient_name VARCHAR(255) NOT NULL,unit VARCHAR(50) NULL,expected_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,actual_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY idx_preparation_receipt_items_receipt (receipt_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
db()->exec('CREATE TABLE IF NOT EXISTS inventory_prepared_counts (id VARCHAR(64) PRIMARY KEY,store_id VARCHAR(32) NOT NULL,count_date DATE NOT NULL,note TEXT NULL,created_by VARCHAR(255) NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY idx_inventory_prepared_counts_store_date(store_id,count_date)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
db()->exec('CREATE TABLE IF NOT EXISTS inventory_prepared_count_items (id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,count_id VARCHAR(64) NOT NULL,ingredient_id VARCHAR(64) NOT NULL,actual_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,UNIQUE KEY uniq_inventory_prepared_count_item(count_id,ingredient_id),KEY idx_inventory_prepared_count_items_ingredient(ingredient_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

$method=$_SERVER['REQUEST_METHOD']??'GET';
function overview_date(string $value,string $fallback):string{
 $value=trim($value)?:$fallback;$date=DateTimeImmutable::createFromFormat('!Y-m-d',$value);
 if(!$date||$date->format('Y-m-d')!==$value)respond_error('Khoảng ngày không hợp lệ.',422);
 return $value;
}
function overview_business_today():string{return(new DateTimeImmutable('now',new DateTimeZone('Asia/Ho_Chi_Minh')))->format('Y-m-d');}
if($method==='POST'){
 $user=auth_require_permission('inventory_raw_closings.access');
 $body=read_json_body();$store=field_inventory_require_store($user,trim((string)($body['storeId']??'')));
 if($store==='warehouse')respond_error('Kho thợ sử dụng kiểm kho vật tư, không sử dụng chốt tồn quầy.',422);
 $today=overview_business_today();$date=overview_date((string)($body['countDate']??''),$today);
 if($date>$today)respond_error('Không thể chốt tồn cho ngày tương lai.',422);
 if($date<$today&&($user['role']??'')!=='admin'&&!auth_has_permission($user,'inventory_closings.edit_past'))respond_error('Ngày chốt đã khóa. Chỉ admin hoặc tài khoản có quyền sửa chốt kho quá ngày được chỉnh sửa.',403);
 $items=is_array($body['items']??null)?$body['items']:[];if(!$items)respond_error('Vui lòng nhập tồn thực tế.',422);
 $id=uuidv4();db()->beginTransaction();
 try{
  db()->prepare('INSERT INTO inventory_counter_counts(id,store_id,count_date,note,created_by)VALUES(:id,:store,:date,:note,:actor)')->execute(['id'=>$id,'store'=>$store,'date'=>$date,'note'=>trim((string)($body['note']??'')),'actor'=>(string)($user['displayName']??$user['username']??'admin')]);
  $insert=db()->prepare('INSERT INTO inventory_counter_count_items(count_id,ingredient_id,actual_quantity)VALUES(:count,:ingredient,:quantity)');
  $updateCounterStock=db()->prepare('UPDATE ingredients SET preparation_stock_quantity=:quantity,updated_at=NOW() WHERE id=:ingredient AND store_id=:store');
  $requireIngredient=db()->prepare('SELECT 1 FROM ingredients WHERE id=:ingredient AND store_id=:store AND is_active=1 LIMIT 1');
  foreach($items as$item){$ingredient=trim((string)($item['ingredientId']??''));$quantity=round((float)str_replace(',','.',(string)($item['actualQuantity']??0)),3);if($quantity<0)throw new RuntimeException('Tồn thực tế không được âm.');$requireIngredient->execute(['ingredient'=>$ingredient,'store'=>$store]);if(!$requireIngredient->fetchColumn())throw new RuntimeException('Nguyên liệu không thuộc quầy đang chọn.');$insert->execute(['count'=>$id,'ingredient'=>$ingredient,'quantity'=>$quantity]);$updateCounterStock->execute(['quantity'=>$quantity,'ingredient'=>$ingredient,'store'=>$store]);}
  db()->commit();
 }catch(Throwable $e){if(db()->inTransaction())db()->rollBack();respond_error($e->getMessage(),422);}
 respond_ok(['id'=>$id],201);
}
if($method!=='GET')respond_error('Method not allowed',405);
$user=auth_require_permission(['inventory_stock.view','inventory_raw_closings.access']);
$store=field_inventory_require_store($user,trim((string)($_GET['storeId']??'')));
if($store==='warehouse')respond_error('Kho thợ sử dụng báo cáo tồn vật tư riêng.',422);
$today=overview_business_today();$to=overview_date((string)($_GET['dateTo']??''),$today);
$from=overview_date((string)($_GET['dateFrom']??''),(new DateTimeImmutable($to))->modify('first day of this month')->format('Y-m-d'));
if($from>$to)respond_error('Ngày bắt đầu phải trước ngày kết thúc.',422);
$isAdmin=($user['role']??'')==='admin';
$canEditPast=$isAdmin||auth_has_permission($user,'inventory_closings.edit_past');$isLocked=$to<$today&&!$canEditPast;
$canCount=$isAdmin||auth_has_permission($user,'inventory_raw_closings.access');
$s=db()->prepare('SELECT id,count_date FROM inventory_counter_counts WHERE store_id=:store AND count_date<=:date ORDER BY count_date DESC,created_at DESC LIMIT 1');$s->execute(['store'=>$store,'date'=>$to]);$count=$s->fetch();$actual=[];
if($count){$s=db()->prepare('SELECT ingredient_id,actual_quantity FROM inventory_counter_count_items WHERE count_id=:id');$s->execute(['id'=>$count['id']]);foreach($s->fetchAll()as$row)$actual[(string)$row['ingredient_id']]=(float)$row['actual_quantity'];}
$s=db()->prepare('SELECT id,count_date FROM inventory_counter_counts WHERE store_id=:store AND count_date<:date ORDER BY count_date DESC,created_at DESC LIMIT 1');$s->execute(['store'=>$store,'date'=>$from]);$openingCount=$s->fetch();$openingId=$openingCount['id']??null;$opening=[];
if($openingId){$s=db()->prepare('SELECT ingredient_id,actual_quantity FROM inventory_counter_count_items WHERE count_id=:id');$s->execute(['id'=>$openingId]);foreach($s->fetchAll()as$row)$opening[(string)$row['ingredient_id']]=(float)$row['actual_quantity'];}
$requiredOpeningDate=(new DateTimeImmutable($from))->modify('-1 day')->format('Y-m-d');
$hasExactOpening=($openingCount['count_date']??null)===$requiredOpeningDate;
$hasExactClosing=($count['count_date']??null)===$to;
$s=db()->prepare('SELECT COUNT(*) FROM ingredients prepared WHERE prepared.store_id=:store AND prepared.is_active=1 AND EXISTS(SELECT 1 FROM ingredient_components ic WHERE ic.parent_ingredient_id=prepared.id)');$s->execute(['store'=>$store]);$hasPreparedItems=(int)$s->fetchColumn()>0;
$s=db()->prepare('SELECT id,count_date FROM inventory_prepared_counts WHERE store_id=:store AND count_date<=:date ORDER BY count_date DESC,created_at DESC LIMIT 1');$s->execute(['store'=>$store,'date'=>$to]);$preparedClosingCount=$s->fetch();
$s=db()->prepare('SELECT id,count_date FROM inventory_prepared_counts WHERE store_id=:store AND count_date<:date ORDER BY count_date DESC,created_at DESC LIMIT 1');$s->execute(['store'=>$store,'date'=>$from]);$preparedOpeningCount=$s->fetch();
$hasExactPreparedOpening=!$hasPreparedItems||($preparedOpeningCount['count_date']??null)===$requiredOpeningDate;
$hasExactPreparedClosing=!$hasPreparedItems||($preparedClosingCount['count_date']??null)===$to;
$loadPreparedBySource=static function(?string$countId):array{if(!$countId)return[];$statement=db()->prepare('SELECT ic.component_ingredient_id source_id,SUM(pci.actual_quantity*ic.input_quantity/GREATEST(prepared.conversion_output_quantity,0.000001)) quantity FROM inventory_prepared_count_items pci JOIN ingredients prepared ON prepared.id=pci.ingredient_id JOIN ingredient_components ic ON ic.parent_ingredient_id=prepared.id WHERE pci.count_id=:count GROUP BY ic.component_ingredient_id');$statement->execute(['count'=>$countId]);$result=[];foreach($statement->fetchAll()as$row)$result[(string)$row['source_id']]=(float)$row['quantity'];return$result;};
$preparedOpeningBySource=$loadPreparedBySource($preparedOpeningCount['id']??null);$preparedClosingBySource=$loadPreparedBySource($preparedClosingCount['id']??null);
$canCalculateLoss=$hasExactOpening&&$hasExactClosing&&$hasExactPreparedOpening&&$hasExactPreparedClosing;
$s=db()->prepare('SELECT pri.ingredient_id,SUM(pri.actual_quantity) quantity FROM preparation_receipt_items pri JOIN preparation_receipts pr ON pr.id=pri.receipt_id WHERE pr.store_id=:store AND pr.receipt_date BETWEEN :date_from AND :date_to GROUP BY pri.ingredient_id');
$s->execute(['store'=>$store,'date_from'=>$from,'date_to'=>$to]);$issued=[];foreach($s->fetchAll()as$row)$issued[(string)$row['ingredient_id']]=(float)$row['quantity'];
$s=db()->prepare('SELECT bi.menu_id productCode,MAX(bi.name) productName,SUM(bi.quantity) quantity FROM bill_items bi JOIN bills b ON b.id=bi.bill_id WHERE b.store_id=:store AND b.status=:completed_status AND DATE(b.created_at) BETWEEN :date_from AND :date_to GROUP BY bi.menu_id');
$s->execute(['store'=>$store,'completed_status'=>'completed','date_from'=>$from,'date_to'=>$to]);$sales=[];foreach($s->fetchAll()as$row)$sales[]=['productCode'=>(string)$row['productCode'],'productName'=>(string)$row['productName'],'quantity'=>(float)$row['quantity']];
$preview=products_inventory_resolve_consumption_preview($store,$sales);$used=[];foreach($preview['items']as$row)$used[(string)$row['productId']]=(float)$row['quantity'];
$s=db()->prepare('SELECT id,ingredient_code,ingredient_name,COALESCE(NULLIF(base_unit,""),unit) unit,cost,stock_quantity,preparation_stock_quantity,conversion_source_ingredient_id FROM ingredients WHERE store_id=:store AND is_active=1 ORDER BY ingredient_name');$s->execute(['store'=>$store]);
$items=[];$totals=['warehouseQuantity'=>0.0,'counterQuantity'=>0.0,'usedQuantity'=>0.0,'usedValue'=>0.0,'lossQuantity'=>0.0,'lossValue'=>0.0,'lossPercent'=>null,'warehouseValue'=>0.0,'counterValue'=>0.0];
foreach($s->fetchAll()as$row){if(!empty($row['conversion_source_ingredient_id']))continue;$id=(string)$row['id'];$warehouse=(float)$row['stock_quantity'];$book=(float)$row['preparation_stock_quantity'];$real=$hasExactClosing&&array_key_exists($id,$actual)?$actual[$id]:null;$usedQty=$used[$id]??0.0;$issuedQty=$issued[$id]??0.0;$expected=$hasExactOpening&&array_key_exists($id,$opening)?round($opening[$id]+$issuedQty-$usedQty,3):$book;$preparedDelta=($preparedClosingBySource[$id]??0)-($preparedOpeningBySource[$id]??0);$actualUsed=$canCalculateLoss&&$real!==null&&array_key_exists($id,$opening)?round($opening[$id]+$issuedQty-$real-$preparedDelta,3):null;$loss=$actualUsed!==null?round($actualUsed-$usedQty,3):null;$lossPercent=$loss!==null&&$usedQty>0?round($loss/$usedQty*100,2):null;$cost=(float)($row['cost']??0);$counter=$real??$book;
 $totals['warehouseQuantity']+=$warehouse;$totals['counterQuantity']+=$counter;$totals['usedQuantity']+=$usedQty;$totals['usedValue']+=$usedQty*$cost;$totals['warehouseValue']+=$warehouse*$cost;$totals['counterValue']+=$counter*$cost;if($loss!==null){$totals['lossQuantity']+=$loss;$totals['lossValue']+=$loss*$cost;}
 $items[]=['ingredientId'=>$id,'ingredientCode'=>(string)$row['ingredient_code'],'ingredientName'=>(string)$row['ingredient_name'],'unit'=>(string)($row['unit']??''),'cost'=>$isAdmin?$cost:null,'warehouseQuantity'=>$warehouse,'counterBookQuantity'=>$book,'openingCounterQuantity'=>$hasExactOpening&&array_key_exists($id,$opening)?$opening[$id]:null,'expectedCounterQuantity'=>$expected,'issuedQuantity'=>$issuedQty,'usedQuantity'=>$usedQty,'preparedStockChange'=>round($preparedDelta,3),'actualUsedQuantity'=>$actualUsed,'actualCounterQuantity'=>$real,'lossQuantity'=>$isAdmin?$loss:null,'lossPercent'=>$isAdmin?$lossPercent:null,'warehouseValue'=>$isAdmin?round($warehouse*$cost,2):null,'counterValue'=>$isAdmin?round($counter*$cost,2):null];
}
$totals['lossPercent']=$canCalculateLoss&&$totals['usedValue']>0?round($totals['lossValue']/$totals['usedValue']*100,2):null;
foreach($totals as$key=>$value)if($value!==null)$totals[$key]=round($value,str_contains($key,'Value')?2:3);
respond_ok(['items'=>$items,'totals'=>$totals,'dateFrom'=>$from,'dateTo'=>$to,'isAdmin'=>$isAdmin,'canCount'=>$canCount,'canEditPast'=>$canEditPast,'isLocked'=>$isLocked,'latestCountDate'=>$count['count_date']??null,'openingCountDate'=>$openingCount['count_date']??null,'preparedLatestCountDate'=>$preparedClosingCount['count_date']??null,'preparedOpeningCountDate'=>$preparedOpeningCount['count_date']??null,'canCalculateLoss'=>$canCalculateLoss,'lossMessage'=>$canCalculateLoss?null:'Cần chốt tồn nguyên liệu và tồn bán thành phẩm vào ngày '.date('d/m/Y',strtotime($requiredOpeningDate)).' và '.date('d/m/Y',strtotime($to)).' để tính hao hụt.','recipeErrors'=>$preview['errors']]);
