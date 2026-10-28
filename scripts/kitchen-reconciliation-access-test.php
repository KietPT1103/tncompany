<?php
declare(strict_types=1);

// Exercise the endpoint's actual guard with the production role checker.
$auth = file_get_contents(__DIR__.'/../public/api/_lib/auth.php');
$start = strpos($auth, 'function auth_require(');
$end = strpos($auth, 'function auth_has_permission(', $start);
eval(substr($auth, $start, $end - $start));
function auth_current_user(): ?array { return $GLOBALS['testUser']; }
function respond_error(string $message, int $status): never { throw new RuntimeException($message, $status); }
function auth_require_permission($permissions, array $roles = []): array { return auth_require($roles); }
$endpoint = file_get_contents(__DIR__.'/../public/api/kitchen-reconciliation.php');
if (!preg_match('/\$user\s*=\s*auth_require(?:_permission)?\([^;]+;/', $endpoint, $match)) {
    throw new RuntimeException('Missing endpoint auth guard');
}
foreach (['GET', 'POST'] as $method) {
    $_SERVER['REQUEST_METHOD'] = $method;
    foreach ([null, 'manager', 'user', 'server', 'bartender', 'admin'] as $role) {
        $GLOBALS['testUser'] = $role === null ? null : ['id'=>'fixture', 'role'=>$role, 'permissions'=>['reports.access','reports.ingredient_usage.view']];
        $status = 200;
        try { eval($match[0]); } catch (RuntimeException $e) { $status = $e->getCode(); }
        $expected = $role === null ? 401 : ($role === 'admin' ? 200 : 403);
        if ($status !== $expected) throw new RuntimeException("$method role ".($role ?? 'anonymous').": expected $expected, got $status");
    }
}
echo "PASS reconciliation guard: anonymous denied, non-admin denied despite permissions, admin allowed (GET/POST).\n";
