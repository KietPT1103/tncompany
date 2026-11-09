<?php
declare(strict_types=1);
require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/stores.php';
$user = auth_require();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
try {
    if ($method === 'GET') respond_ok(['items'=>stores_list(db(),$user,($_GET['management'] ?? '') === '1',($_GET['history'] ?? '') === '1')]);
    stores_require_admin($user);
    if ($method === 'POST') respond_ok(['item'=>stores_save(db(),$user,null,read_json_body())],201);
    $id = trim((string)($_GET['id'] ?? ''));
    if ($id === '') respond_error('Thiếu mã quầy.',422);
    if ($method === 'PATCH' || $method === 'PUT') respond_ok(['item'=>stores_save(db(),$user,$id,read_json_body())]);
    if ($method === 'DELETE') { stores_delete(db(),$user,$id); respond_ok(); }
    respond_error('Method not allowed',405);
} catch (DomainException $e) { respond_error($e->getMessage(),$e->getCode()); }
