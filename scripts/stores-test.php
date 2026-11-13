<?php
declare(strict_types=1);
require_once __DIR__ . '/../public/api/_lib/stores.php';
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE stores(id VARCHAR(32) PRIMARY KEY,name TEXT NOT NULL,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
$pdo->exec("INSERT INTO stores(id,name) VALUES('cafe','Cafe'),('restaurant','Bếp')");
$pdo->exec('CREATE TABLE bills(id TEXT,store_id TEXT)');
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
function rejected(callable $run, int $code): void {
    try { $run(); } catch (DomainException $e) { check($e->getCode() === $code, $e->getMessage()); return; }
    throw new RuntimeException('Expected rejection ' . $code);
}
$admin = ['role'=>'admin'];
stores_ensure_schema($pdo);
stores_ensure_schema($pdo);
check(count(stores_list($pdo, $admin, true)) === 2, 'Migration preserves defaults and is repeatable');
rejected(fn()=>stores_save($pdo, ['role'=>'manager'], null, ['name'=>'New']), 403);
rejected(fn()=>stores_save($pdo, $admin, null, ['name'=>'  ']), 422);
rejected(fn()=>stores_save($pdo, $admin, null, ['name'=>['invalid']]), 422);
rejected(fn()=>stores_save($pdo, $admin, null, ['name'=>'New','isTakeAway'=>'invalid']), 422);
$new = stores_save($pdo, $admin, null, ['name'=>' Quầy mới ', 'address'=>' 123 Đường A ', 'isTakeAway'=>true, 'isActive'=>true]);
check($new['name'] === 'Quầy mới' && $new['address'] === '123 Đường A' && $new['isTakeAway'], 'Creates and trims metadata');
check(strlen($new['id']) <= 32 && $new['id'] !== 'cafe', 'Generated ID fits existing foreign keys');
check(($new['takeawayShiftEnabled'] ?? null) === false, 'Default legacy shifts');
check($new['takeawayShiftCount']===1 && $new['takeawayFinalShift']===1,'Default shift count');
foreach ([['takeawayShiftCount'=>0],['takeawayShiftCount'=>25],['takeawayShiftCount'=>2.5],['takeawayFinalShift'=>2],['takeawayShiftEnabled'=>1]] as $invalid) rejected(fn()=>stores_save($pdo,$admin,$new['id'],$invalid),422);
rejected(fn()=>stores_save($pdo,$admin,'cafe',['takeawayShiftEnabled'=>true]),422);
$config=stores_save($pdo,$admin,$new['id'],['takeawayShiftEnabled'=>true,'takeawayShiftCount'=>24,'takeawayFinalShift'=>10]);
check($config['takeawayShiftCount']===24 && $config['takeawayFinalShift']===10,'Persists configuration');
$pdo->exec('CREATE TABLE takeaway_business_cycles(id TEXT,store_id TEXT,closed_at TEXT)');
$pdo->prepare('INSERT INTO takeaway_business_cycles VALUES (?,?,NULL)')->execute(['cycle',$new['id']]);
foreach ([['takeawayShiftEnabled'=>false],['takeawayShiftCount'=>23],['takeawayFinalShift'=>9],['isTakeAway'=>false]] as $change) rejected(fn()=>stores_save($pdo,$admin,$new['id'],$change),409);
check(stores_save($pdo,$admin,$new['id'],['name'=>$new['name']])['takeawayShiftEnabled'],'Metadata edit during cycle');
$pdo->exec("UPDATE takeaway_business_cycles SET closed_at='2026-11-13'");
$pdo->exec('CREATE TABLE cashier_shifts(id TEXT,store_id TEXT,status TEXT)');
$pdo->prepare("INSERT INTO cashier_shifts VALUES (?,?,'open')")->execute(['legacy',$new['id']]);
rejected(fn()=>stores_save($pdo,$admin,$new['id'],['takeawayShiftEnabled'=>false]),409);
$pdo->exec("UPDATE cashier_shifts SET status='closed'");
stores_save($pdo,$admin,$new['id'],['takeawayShiftEnabled'=>false,'takeawayShiftCount'=>1,'takeawayFinalShift'=>1]);
$staff = ['id'=>'staff-1','role'=>'user','storeId'=>$new['id'],'storeIds'=>[$new['id']]];
check(array_column(stores_list($pdo,$staff), 'id') === [$new['id']], 'Staff only sees assigned dynamic stores');
check(stores_list($pdo,['role'=>'user']) === [], 'No assignment grants no stores');
rejected(fn()=>stores_list($pdo,$staff,true),403);
stores_require_available($pdo,$new['id']);
$edited=stores_save($pdo,$admin,$new['id'],['name'=>'Đổi tên','isActive'=>false,'isTakeAway'=>false]);
check($edited['address']==='123 Đường A' && !$edited['isActive'] && !$edited['isTakeAway'], 'Updates preserve omitted values');
check(stores_list($pdo,$staff)===[], 'Inactive excluded from operational selection');
check(array_column(stores_list($pdo,$staff,false,true),'id')===[$new['id']], 'Assigned inactive stores remain selectable for historical reads');
check(count(stores_list($pdo,$admin,true))===3,'Management still shows inactive');
rejected(fn()=>stores_require_available($pdo,$new['id']),409);
stores_save($pdo,$admin,$new['id'],['isActive'=>true]);
$pdo->prepare('INSERT INTO bills VALUES (?,?)')->execute(['bill-1',$new['id']]);
rejected(fn()=>stores_delete($pdo,$staff,$new['id']),403);
stores_delete($pdo,$admin,$new['id']);
check(count(stores_list($pdo,$admin,true))===2,'Soft deleted hidden from management');
check($pdo->query('SELECT COUNT(*) FROM stores')->fetchColumn()==3,'Soft delete retains store row');
check($pdo->query('SELECT COUNT(*) FROM bills')->fetchColumn()==1,'Soft delete retains transaction history');
check(count(stores_list($pdo,$admin,false,true))===3,'History includes soft deleted stores with their metadata');
rejected(fn()=>stores_require_available($pdo,$new['id']),409);
rejected(fn()=>stores_save($pdo,$admin,$new['id'],['isActive'=>true]),404);
rejected(fn()=>stores_require_available($pdo,'missing'),404);
// Exercise the real inventory store gate without bootstrapping unrelated schemas.
function db(): PDO { global $pdo; return $pdo; }
function respond_error(string $message, int $code): void { throw new DomainException($message,$code); }
$source = file_get_contents(__DIR__ . '/../public/api/_lib/field_inventory.php');
$start = strpos($source, 'function field_inventory_can_access_store(');
$end = strpos($source, 'function field_inventory_datetime(', $start);
eval(substr($source,$start,$end-$start));
$pdo->exec('CREATE TABLE user_store_access(user_id TEXT,store_id TEXT)');
check(array_column(field_inventory_allowed_stores($staff),'id')===[$new['id']],'Inventory history retains assigned deleted stores');
check(field_inventory_allowed_stores($staff,true)===[],'Inventory creation choices exclude deleted stores');
$_SERVER['REQUEST_METHOD'] = 'GET';
check(field_inventory_require_store($admin,$new['id']) === $new['id'],'Inventory historical reads still allowed');
foreach (['POST','PATCH','PUT'] as $method) {
    $_SERVER['REQUEST_METHOD'] = $method;
    rejected(fn()=>field_inventory_require_store($admin,$new['id']),409);
}
echo "PASS stores: migration, CRUD, metadata, permissions, dynamic scope, inactive state and historical preservation\n";
