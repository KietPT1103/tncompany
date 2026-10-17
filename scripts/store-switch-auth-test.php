<?php
declare(strict_types=1);
$source = file_get_contents(__DIR__ . '/../public/api/_lib/auth.php');
$start = strpos($source, 'function auth_normalize_role(');
$end = strpos($source, 'function auth_current_user(', $start);
eval(substr($source, $start, $end - $start));
function db(): PDO {
    static $pdo;
    return $pdo ??= new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
}
function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
db()->exec('CREATE TABLE user_store_access(user_id TEXT, store_id TEXT)');
db()->exec("INSERT INTO user_store_access VALUES ('test','farm'),('test','warehouse'),('other','restaurant')");
$row = ['id'=>'test', 'email'=>'test@example.com', 'username'=>'test', 'display_name'=>'Test', 'role'=>'server', 'store_id'=>'cafe', 'permissions_json'=>'["stores.switch"]'];
$user = auth_map_user($row);
check($user['storeIds'] === ['farm','warehouse','cafe'], 'Login scope includes assigned areas and primary store, excludes other users');
check($user['permissions'] === ['stores.switch'], 'Explicit switch grant survives API normalization without extra privileges');
$row['store_id'] = 'farm';
check(auth_map_user($row)['storeIds'] === ['farm','warehouse'], 'Primary store is not duplicated');
$row['id'] = 'legacy';
$row['store_id'] = 'restaurant';
check(auth_map_user($row)['storeIds'] === ['restaurant'], 'Legacy primary store remains available');
$row['store_id'] = null;
check(auth_map_user($row)['storeIds'] === [], 'Missing scope does not grant all stores');
foreach (['user','server','bartender'] as $role) {
    check(in_array('stores.switch', auth_effective_permissions(['role'=>$role,'permissions_json'=>'["stores.switch"]']), true), 'Explicit grant accepted for ' . $role);
    check(!in_array('stores.switch', auth_default_permissions_for_role($role), true), 'Switching is opt-in for ' . $role);
}
echo "PASS auth store switching: grant persistence, scoped login payload, primary-store fallback\n";
