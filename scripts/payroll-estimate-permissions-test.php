<?php
declare(strict_types=1);

// Exercise the endpoint's actual store guard without bootstrapping the live database.
$source = file_get_contents(__DIR__ . '/../public/api/payrolls.php');
$start = strpos($source, 'function payrolls_require_estimate_store(');
$end = strpos($source, 'payrolls_ensure_tables();', $start);
eval(substr($source, $start, $end - $start));

function db(): PDO
{
    static $pdo;
    return $pdo ??= new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
}

function respond_error(string $message, int $status): never
{
    throw new RuntimeException($message, $status);
}

function verify_access(array $user, string $store, ?int $error = null): void
{
    $_GET = ['storeId' => $store];
    try {
        $result = payrolls_require_estimate_store($user);
    } catch (RuntimeException $exception) {
        if ($error === $exception->getCode()) return;
        throw $exception;
    }
    if ($error !== null || $result !== $store) {
        throw new RuntimeException('Unexpected store access for ' . $user['role'] . ': ' . $store);
    }
}

db()->exec('CREATE TABLE user_store_access(user_id TEXT, store_id TEXT)');
db()->exec("INSERT INTO user_store_access VALUES ('staff','restaurant'),('other','farm')");
$manager = ['id' => 'manager', 'role' => 'manager', 'storeId' => 'cafe'];
foreach (['cafe', 'restaurant', 'farm', 'bakery', 'warehouse'] as $store) {
    verify_access($manager, $store);
    verify_access(['id' => 'admin', 'role' => 'admin'], $store);
}
foreach (['user', 'server', 'bartender'] as $role) {
    $staff = ['id' => 'staff', 'role' => $role, 'storeId' => 'cafe'];
    verify_access($staff, 'cafe');
    verify_access($staff, 'restaurant');
    verify_access($staff, 'farm', 403);
    verify_access($staff, 'warehouse', 403);
}
verify_access(['id' => 'unassigned', 'role' => 'user'], 'restaurant', 403);
verify_access($manager, 'invalid', 422);
verify_access($manager, '', 422);
verify_access(['id' => 'admin', 'role' => 'admin'], 'invalid', 422);
echo "PASS estimate store access: manager across stores, scoped staff, invalid stores\n";
