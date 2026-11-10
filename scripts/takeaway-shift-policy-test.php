<?php
declare(strict_types=1);
require_once __DIR__.'/../public/api/_lib/stores.php';
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
function db():PDO {global $pdo;return $pdo;}
function check(bool $ok,string $message):void {if(!$ok)throw new RuntimeException($message);}
class GuardRejection extends RuntimeException {public function __construct(public int $status){parent::__construct();}}
function respond_error(string $message,int $status):never {throw new GuardRejection($status);}
$pdo->exec('CREATE TABLE stores(id TEXT PRIMARY KEY,name TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
$pdo->exec("INSERT INTO stores(id,name) VALUES('bau','Bậu'),('other','Other'),('farm','Farm'),('warehouse','Kho')");
stores_ensure_schema($pdo);stores_save($pdo,['role'=>'admin'],'bau',['isTakeAway'=>true]);
$source=file_get_contents(__DIR__.'/../public/api/pos.php');$start=strpos($source,'function pos_validate_shift_for_write(');$end=strpos($source,"if (\$method === 'GET' && \$resource === 'tables')",$start);eval(substr($source,$start,$end-$start));
foreach(['cafe','restaurant','bakery','bau'] as $store){
    try {pos_validate_shift_for_write([],['role'=>'user'],$store);throw new RuntimeException('Missing shift accepted for '.$store);}
    catch(GuardRejection $e){check($e->status===409,'Expected open-shift requirement');}
}
foreach(['other','farm','warehouse'] as $store)pos_validate_shift_for_write([],['role'=>'user'],$store);
pos_validate_shift_for_write([],['role'=>'admin'],'bau');
echo "PASS shift policy: takeaway cashiers require shifts; legacy stores, other stores and admin unchanged\n";
