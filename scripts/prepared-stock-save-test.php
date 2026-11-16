<?php
declare(strict_types=1);
$pdo=new class('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]) extends PDO {
    public function prepare(string $query,array $options=[]):PDOStatement|false {return parent::prepare(str_replace(' FOR UPDATE','',$query),$options);}
};
function db():PDO {global $pdo;return $pdo;}
function uuidv4():string {return bin2hex(random_bytes(16));}
function prepared_stock_actor(array $user):string {return 'Admin';}
class SaveResponse extends RuntimeException {}
function respond_ok(array $payload,int $status):never {throw new SaveResponse('ok');}
function respond_error(string $message,int $status):never {throw new RuntimeException($message);}
function check(bool $ok,string $message):void {if(!$ok)throw new RuntimeException($message);}
$pdo->sqliteCreateFunction('NOW',fn()=>'2026-11-16 12:00:00');
$pdo->exec('CREATE TABLE ingredients(id TEXT,store_id TEXT,is_active INTEGER,preparation_stock_quantity REAL,updated_at TEXT)');
$pdo->exec("INSERT INTO ingredients VALUES ('tea','cafe',1,100,NULL)");
$pdo->exec("CREATE TABLE ingredient_components(parent_ingredient_id TEXT); INSERT INTO ingredient_components VALUES ('tea')");
$pdo->exec('CREATE TABLE inventory_prepared_counts(id TEXT,store_id TEXT,count_date TEXT,note TEXT,created_by TEXT)');
$pdo->exec('CREATE TABLE inventory_prepared_count_items(count_id TEXT,ingredient_id TEXT,actual_quantity REAL)');
$source=file_get_contents(__DIR__.'/../public/api/prepared-stock.php');
$start=strpos($source,'    $rawItems =');$end=strpos($source,"\nif (\$method !== 'GET')",$start);
$saveCode=substr($source,$start,$end-$start);
// Remove only the enclosing POST branch's closing brace.
$saveCode=preg_replace('/\}\s*$/','',$saveCode);
function save_count(string $date,float $quantity,float $expected):void {
    global $saveCode;
    $body=['items'=>[['ingredientId'=>'tea','actualQuantity'=>$quantity,'expectedQuantity'=>$expected]]];
    $storeId='cafe';$today='2026-11-16';$countDate=$date;$user=[];
    try {eval($saveCode);} catch(SaveResponse $response) {return;}
}
save_count('2026-11-16',90,100);
check((float)$pdo->query('SELECT preparation_stock_quantity FROM ingredients')->fetchColumn()===90.0,'today saves live stock');
$pdo->exec('UPDATE ingredients SET preparation_stock_quantity=60');
$rejected=false;try {save_count('2026-11-16',80,90);}catch(RuntimeException $e){$rejected=str_contains($e->getMessage(),'Tồn đã thay đổi');}
check($rejected,'rejects stale screen after transfer');
check((float)$pdo->query('SELECT preparation_stock_quantity FROM ingredients')->fetchColumn()===60.0,'stale save preserves transferred balance');
check((int)$pdo->query('SELECT COUNT(*) FROM inventory_prepared_counts')->fetchColumn()===1,'stale closing rolls back audit');
save_count('2026-11-15',150,90);
check((float)$pdo->query('SELECT preparation_stock_quantity FROM ingredients')->fetchColumn()===60.0,'past closing preserves current live stock');
$pdo->exec('UPDATE ingredients SET preparation_stock_quantity=0');
save_count('2026-11-16',10,0);
check((float)$pdo->query('SELECT preparation_stock_quantity FROM ingredients')->fetchColumn()===10.0,'zero stock remains saveable');
echo "PASS production prepared save: current, stale screen, rollback, past closing and zero balance\n";
