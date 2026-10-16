<?php
declare(strict_types=1);
$source=file_get_contents(__DIR__.'/../public/api/inventory-receipts.php');
$start=strpos($source,'function receipts_list(');$end=strpos($source,'function receipts_create(', $start);eval(substr($source,$start,$end-$start));
const FIELD_RECEIPT_STATUSES=['pending_explanation','draft','completed','cancelled','deleted'];
$admin=true;
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE TABLE inventory_receipts(id TEXT,store_id TEXT,status TEXT,entry_source TEXT,evidence_receipt_id TEXT)');
$pdo->exec('CREATE TABLE inventory_receipt_images(receipt_id TEXT)');
$pdo->exec('CREATE TABLE inventory_receipt_items(receipt_id TEXT)');
$pdo->exec("INSERT INTO inventory_receipts VALUES ('active','cafe','completed','web_manual',NULL),('deleted','cafe','deleted','web_manual',NULL),('other-store','farm','deleted','web_manual',NULL)");
// No images: unified evidence view must still include these receipts.
class FilterResult extends RuntimeException { public array $ids; public function __construct(array $ids){parent::__construct('captured');$this->ids=$ids;} }
class FilterStatement {
 public function __construct(private string $sql){}
 public function execute(array $params): void { global $pdo;$sql=str_replace('COUNT(*)','id',$this->sql);$q=$pdo->prepare($sql);$q->execute($params);throw new FilterResult($q->fetchAll(PDO::FETCH_COLUMN)); }
}
class FilterDatabase { public function prepare(string $sql): FilterStatement{return new FilterStatement($sql);} }
function db(){return new FilterDatabase();}
function field_inventory_require_permission($permission){global $admin;return ['role'=>$admin?'admin':'user'];}
function field_inventory_is_admin($user){return $user['role']==='admin';}
function field_inventory_refresh_receipt_lock(){}
function field_inventory_allowed_stores($user){return [['id'=>'cafe']];}
function receipts_store(){return '';}
function respond_error($message,$code){throw new RuntimeException($message,$code);}
function checkFilter(array $filters,array $expected):void {$_GET=$filters;try{receipts_list();}catch(FilterResult $result){sort($result->ids);sort($expected);if($result->ids!==$expected)throw new RuntimeException('Unexpected filtered rows');return;}throw new RuntimeException('Missing result');}
foreach(['ledger','evidence',''] as $view){checkFilter(['view'=>$view],['active']);checkFilter(['view'=>$view,'status'=>'deleted'],['deleted']);checkFilter(['view'=>$view,'status'=>'completed'],['active']);}
$admin=false;checkFilter(['view'=>'evidence'],['active']);
try{$_GET=['view'=>'evidence','status'=>'deleted'];receipts_list();throw new RuntimeException('Missing denial');}catch(RuntimeException $error){if($error->getCode()!==403)throw $error;}
echo "PASS deleted receipt filtering: admin default hidden, archive only, store isolation, ledger/evidence, non-admin denial\n";
