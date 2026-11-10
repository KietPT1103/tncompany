<?php
declare(strict_types=1);
require_once __DIR__.'/../public/api/_lib/stores.php';
require_once __DIR__.'/../public/api/_lib/takeaway_print_jobs.php';
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
function db():PDO {global $pdo;return $pdo;}
function check(bool $ok,string $message):void {if(!$ok)throw new RuntimeException($message);}
class CheckoutResponse extends Exception {public function __construct(public array $payload){parent::__construct();}}
function respond_ok(array $payload,int $status=200):never {throw new CheckoutResponse($payload);}
function respond_error(string $message,int $status):never {throw new RuntimeException($message);}
function auth_has_permission(array $user,string $permission):bool{return true;}
function pos_find_bill_by_checkout_request(string $store,string $request):?string {if($request==='')return null;$q=db()->prepare('SELECT id FROM bills WHERE store_id=? AND checkout_request_id=?');$q->execute([$store,$request]);return $q->fetchColumn()?:null;}
function pos_validate_shift_for_write(...$args):void{}
function pos_next_bill_id(string $store):string {static $number=0;return $store.'-'.++$number;}
function pos_replace_bill_children(...$args):void{}
function ingredient_usage_capture_bill(...$args):void{}
function ingredient_usage_recipe_resolver(){return null;}
function realtime_publish(...$args):void{}
$mapped=0;
function pos_map_bills(array $rows):array {global $mapped,$body;$mapped++;$r=$rows[0];return [['id'=>$r['id'],'storeId'=>$r['store_id'],'status'=>$r['status'],'total'=>$r['total'],'items'=>$body['items']]];}
$pdo->exec('CREATE TABLE stores(id TEXT PRIMARY KEY,name TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
$pdo->exec("INSERT INTO stores(id,name) VALUES('cafe','Cafe'),('cart','Cart')");stores_ensure_schema($pdo);
$pdo->exec('CREATE TABLE bills(id TEXT PRIMARY KEY,store_id TEXT,table_number TEXT,note TEXT,total REAL,subtotal_before_surcharge REAL,surcharge_total REAL,discount_type TEXT,discount_value REAL,discount_amount REAL,status TEXT,payment_method TEXT,cash_received REAL,change_amount REAL,shift_id TEXT,cashier_id TEXT,cashier_name TEXT,order_source TEXT,checkout_request_id TEXT)');
$source=file_get_contents(__DIR__.'/../public/api/pos.php');
$start=strpos($source,"if (\$method === 'POST' && \$resource === 'bills') {");$end=strpos($source,"if (\$method === 'PATCH' && \$resource === 'bills') {",$start);
check($start!==false && $end!==false,'Checkout production block exists');$checkout=substr($source,$start,$end-$start);
function run_checkout(string $store,string $request):array {global $checkout;$posStoreId=$store;$method='POST';$resource='bills';$user=['role'=>'user'];$body=['storeId'=>$store,'total'=>20000,'checkoutRequestId'=>$request,'items'=>[['name'=>'Nước','quantity'=>2,'price'=>10000]]];$GLOBALS['body']=$body;try{eval($checkout);}catch(CheckoutResponse $response){return $response->payload;}throw new RuntimeException('Missing response');}
$old=run_checkout('cafe','old-request-123456');
check($old['printQueued']===false && $mapped===0,'Cafe checkout skips queue snapshot mapping');
check($pdo->query("SELECT name FROM sqlite_master WHERE name='takeaway_print_jobs'")->fetchColumn()===false,'Cafe checkout does not create or access takeaway schema');
$same=run_checkout('cafe','old-request-123456');check($same['id']===$old['id'] && $same['printQueued']===false,'Cafe idempotent checkout remains unchanged');
stores_save($pdo,['role'=>'admin'],'cart',['isTakeAway'=>true,'takeawayPrintingEnabled'=>true]);
$new=run_checkout('cart','new-request-123456');check($new['printQueued']===true && count(takeaway_print_list($pdo,'cart'))===3,'Enabled cart atomically saves bill and three jobs');
$again=run_checkout('cart','new-request-123456');check($again['id']===$new['id'] && $again['printQueued']===true && count(takeaway_print_list($pdo,'cart'))===3,'Cart retry does not duplicate bill or print jobs');
echo "PASS production checkout isolation: cafe has no queue side effects; takeaway queue/idempotency work\n";
