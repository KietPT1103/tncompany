<?php
declare(strict_types=1);
// Isolated in-memory database; no application config, credentials, or real data is loaded.
require __DIR__.'/../public/api/_lib/internal_invoice_warehouse.php';
class TestDatabase extends PDO {
    public array $queries=[];
    public function __construct() { parent::__construct('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]); }
    public function prepare(string $query, array $options=[]): PDOStatement|false {
        $this->queries[]=$query;
        $query=str_replace(' FOR UPDATE','',$query);
        $query=str_replace('<=>','IS',$query); // SQLite equivalent of MySQL null-safe equality.
        $query=str_replace('ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)','ON CONFLICT(normalized_name) DO UPDATE SET id=id',$query);
        return parent::prepare($query,$options);
    }
}
$testDb=new TestDatabase();
function db(): PDO { global $testDb; return $testDb; }
function uuidv4(): string {return bin2hex(random_bytes(16));}
class ApiResult extends RuntimeException { public array $data; public function __construct(array $data){$this->data=$data;} }
function respond_ok(array $data): never {throw new ApiResult($data);}
function respond_error(string $message,int $status=400): never {throw new RuntimeException($message,$status);}
function auth_has_permission(array $user,string $permission): bool {return $user['allowed'] ?? false;}
function auth_require_permission($permission): array {global $permissionAllowed; if(!$permissionAllowed) respond_error('Forbidden',403); return ['allowed'=>true];}
function check($condition,$message){if(!$condition)throw new RuntimeException($message);}
$testDb->exec("CREATE TABLE invoice_entries(id TEXT PRIMARY KEY,store_id TEXT,invoice_scope TEXT,invoice_number TEXT,partner_name TEXT,invoice_date TEXT,note TEXT,total_amount REAL,created_by TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE internal_invoice_categories(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,normalized_name TEXT UNIQUE);
CREATE TABLE invoice_entry_items(id INTEGER PRIMARY KEY AUTOINCREMENT,invoice_id TEXT,item_name TEXT,quantity REAL,unit TEXT,unit_price REAL,line_total REAL,internal_category_id INTEGER);
CREATE TABLE invoice_entry_evidences(id INTEGER PRIMARY KEY AUTOINCREMENT,invoice_id TEXT,file_path TEXT,file_name TEXT,original_name TEXT,mime_type TEXT,file_size INTEGER,uploaded_at TEXT);");
// Cut at the actual endpoint dispatcher, leaving production persistence functions intact.
$source=explode("\n$"."method =",file_get_contents(__DIR__.'/../public/api/invoice-entries.php'))[0];
$source=preg_replace('/^<\?php|^declare\(strict_types=1\);|^require_once .*;\r?$/m','',$source);
eval($source);
$tiny = invoice_parse_items([['name'=>'Tiny','quantity'=>0.001,'unitPrice'=>1]], true);
check(count($tiny)===1 && $tiny[0]['quantity']===0.001, 'preserve received quantity when line total rounds to zero');
$cat=internal_invoice_category('Gỗ');
$user=['allowed'=>true,'id'=>'test-user'];
$_FILES=[];
$_POST=['scope'=>'internal','storeId'=>'cafe','invoiceDate'=>'2026-10-18','items'=>json_encode([['name'=>'Ván','quantity'=>2.125,'unit'=>'tấm','unitPrice'=>100,'categoryId'=>$cat]])];
$first=invoice_save_entry($user);
check($first['storeId']==='internal','shared internal metadata');
check(str_starts_with($first['invoiceNumber'],'NB-'),'automatic invoice number');
check($first['items'][0]['categoryName']==='Gỗ','category persistence');
check($first['items'][0]['quantity']===2.125,'quantity precision');
$number=$first['invoiceNumber'];
$_POST=['scope'=>'internal','storeId'=>'farm','invoiceDate'=>'2026-10-18','invoiceNumber'=>'MANUAL','items'=>json_encode([['name'=>'Ván','quantity'=>3,'unit'=>'tấm','unitPrice'=>100,'categoryId'=>$cat]])];
$second=invoice_save_entry($user);
check($second['invoiceNumber']!==$number,'distinct number');
// Old internal and tax history must be distinguished without relying on Store.
$testDb->exec("INSERT INTO invoice_entries(id,store_id,invoice_scope,invoice_date,total_amount) VALUES('old','cafe','internal','2026-01-01',0),('tax','cafe','tax','2026-01-01',0);
INSERT INTO invoice_entry_items(invoice_id,item_name,quantity,unit,unit_price,line_total) VALUES('old','Ván',4,'kg',12,48),('tax','Ván',999,'tấm',10,9990)");
$endpoint=file_get_contents(__DIR__.'/../public/api/internal-invoice-warehouse.php');
$endpoint=preg_replace('/^<\?php|^declare\(strict_types=1\);|^require_once .*;\r?$/m','',$endpoint);
$endpoint=str_replace('internal_invoice_ensure_schema();','',$endpoint);
$permissionAllowed=true;
function warehouse(array $query=[]):array {global $endpoint;$_GET=$query;$_SERVER['REQUEST_METHOD']='GET';try{eval($endpoint);}catch(ApiResult $e){return $e->data;}throw new RuntimeException('No response');}
$data=warehouse();
check($data['pagination']['total']===2,'separate unit/category rows, tax excluded');
$quantities=array_column($data['items'],'totalReceived','unit');
check(abs($quantities['tấm']-5.125)<0.00001 && $quantities['kg']===4.0,'aggregate history');
check(warehouse(['categoryId'=>'uncategorized'])['pagination']['total']===1,'uncategorized history');
check(warehouse(['search'=>'missing'])['pagination']['total']===0,'search');
$testDb->exec("UPDATE invoice_entries SET updated_at='2026-01-01' WHERE id='".$first['id']."'; UPDATE invoice_entries SET updated_at='2026-01-02' WHERE id='".$second['id']."'");
$_POST=['scope'=>'internal','action'=>'update','id'=>$first['id'],'invoiceDate'=>'2026-10-18','invoiceNumber'=>'OVERRIDE','items'=>json_encode([['name'=>'Ván','quantity'=>1,'unit'=>'tấm','unitPrice'=>99,'categoryId'=>$cat]])];
$updated=invoice_save_entry($user);
check($updated['invoiceNumber']===$number,'preserve generated number on edit');
$quantities=array_column(warehouse()['items'],'totalReceived','unit');
check($quantities['tấm']===4.0,'edit replaces stock');
$suggestions=warehouse(['view'=>'suggestions','search'=>'Ván']);
check(count($suggestions['items'])===2,'deduplicate materials, exclude tax');
$tam=array_values(array_filter($suggestions['items'],fn($i)=>$i['unit']==='tấm'))[0];
check($tam['unitPrice']===99.0,'most recently saved material price');
$delete=$testDb->prepare('DELETE FROM invoice_entry_items WHERE invoice_id=?');$delete->execute([$first['id']]);
$delete=$testDb->prepare('DELETE FROM invoice_entries WHERE id=?');$delete->execute([$first['id']]);
$quantities=array_column(warehouse()['items'],'totalReceived','unit');check($quantities['tấm']===3.0,'delete removes quantities');
$permissionAllowed=false;
try{warehouse();throw new RuntimeException('Permission bypass');}catch(RuntimeException $e){check($e->getCode()===403,'permission check');}
echo "PASS isolated invoice persistence, warehouse aggregation, edits, deletes, history, suggestions and permissions\n";

require __DIR__.'/../public/api/_lib/internal_invoice_import.php';
$testDb->exec('CREATE TABLE internal_invoice_import_operations(operation_id TEXT PRIMARY KEY,payload_hash TEXT,result_json TEXT)');
function applyImport(array $body,array $user):array {db()->beginTransaction();try{$result=internal_import_apply($body,$user);db()->commit();return $result;}catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}}
$incoming=['invoiceDate'=>'2026-10-18','note'=>'Import Excel sheet: Test | Dong: 3 | Nhom: Gỗ','items'=>[['name'=>'Ván','quantity'=>3,'unit'=>'tấm','unitPrice'=>100,'categoryName'=>'']]];
$preview=internal_import_preview($incoming);
check($preview['status']==='existing','reimport ignores source notes');
$testDb->exec("UPDATE invoice_entry_items SET internal_category_id=NULL WHERE invoice_id='".$second['id']."'");
$incoming['items'][0]['categoryName']='Thép';
$preview=internal_import_preview($incoming);
check($preview['status']==='category','old bill can gain category');
$body=['operationId'=>bin2hex(random_bytes(16)),'action'=>'category','incoming'=>$incoming,'targetId'=>$second['id'],'expectedVersion'=>$preview['candidates'][0]['version']];
$before=invoice_get_entry_or_null($second['id']);
$testDb->queries=[];
applyImport($body,$user);
check(str_contains($testDb->queries[0],'FOR UPDATE') && str_contains($testDb->queries[1],'FOR UPDATE') && str_contains($testDb->queries[1],'invoice_entries'),'lock operation and target before snapshot reads');
$after=invoice_get_entry_or_null($second['id']);
check($after['totalAmount']===$before['totalAmount'] && $after['items'][0]['quantity']===$before['items'][0]['quantity'],'category-only preserves quantity/money');
check($after['items'][0]['categoryName']==='Thép','category updated from reviewed source');
check(applyImport($body,$user)['id']===$second['id'],'network retry returns cached operation');
$incoming['items'][0]['categoryName']='';
$incoming['items'][0]['quantity']=6;
$preview=internal_import_preview($incoming);
check($preview['status']==='changed','quantity modification preview');
$body=['operationId'=>bin2hex(random_bytes(16)),'action'=>'update','incoming'=>$incoming,'targetId'=>$second['id'],'expectedVersion'=>$preview['candidates'][0]['version']];
// Preserve a real evidence record through the invoice replacement path.
$testDb->exec("INSERT INTO invoice_entry_evidences(invoice_id,file_path,file_name,original_name,mime_type,file_size) VALUES('".$second['id']."','existing.png','existing.png','existing.png','image/png',10)");
$body['expectedVersion']=internal_import_version(invoice_get_entry_or_null($second['id']));
applyImport($body,$user);
$after=invoice_get_entry_or_null($second['id']);
check($after['items'][0]['quantity']===6.0 && count($after['evidences'])===1,'update replaces quantity and retains evidence');
check($after['items'][0]['categoryName']==='Thép','blank incoming category retains current category');
$stale=$body;$stale['operationId']=bin2hex(random_bytes(16));
try{applyImport($stale,$user);throw new RuntimeException('stale overwrite');}catch(RuntimeException $e){check($e->getCode()===409,'reject stale preview');}
$new=['invoiceDate'=>'2026-10-19','note'=>'Import Excel sheet: Test | Dong: 9','items'=>[['name'=>'Búa','quantity'=>2,'unit'=>'cái','unitPrice'=>30]]];
$body=['operationId'=>bin2hex(random_bytes(16)),'action'=>'create','incoming'=>$new];
$created=applyImport($body,$user);
check(applyImport($body,$user)['id']===$created['id'],'create retry does not duplicate');
$body['operationId']=bin2hex(random_bytes(16));
try{applyImport($body,$user);throw new RuntimeException('duplicate create');}catch(RuntimeException $e){check($e->getCode()===409,'reject duplicate at apply time');}
$body['forceNew']=true;
check(applyImport($body,$user)['id']!==$created['id'],'explicit distinct purchase remains possible');
echo "PASS import apply: category-only, quantity replacement, evidence, idempotency, stale and duplicate guards\n";
