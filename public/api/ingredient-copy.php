<?php
declare(strict_types=1);
require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/ingredient_copy.php';
if (($_SERVER['REQUEST_METHOD']??'GET')!=='POST') respond_error('Method not allowed',405);
$user=auth_require_permission('products.create');
$body=read_json_body();
$source=field_inventory_require_store($user,trim((string)($body['storeId']??'')));
$destination=field_inventory_require_store($user,trim((string)($body['destinationStoreId']??'')));
if ($source==='warehouse'||$destination==='warehouse') respond_error('Chỉ sao chép nguyên liệu giữa các quầy kinh doanh.',422);
ingredients_ensure_schema();
try { $result=ingredient_copy_catalog(db(),$source,$destination,is_array($body['ingredientIds']??null)?$body['ingredientIds']:[]); }
catch (Throwable $e) { respond_error($e->getMessage(),422); }
respond_ok($result,201);
