<?php
declare(strict_types=1);
define('BOOTSTRAP_SKIP_DB',true);
require_once __DIR__.'/_lib/bootstrap.php';
require_once __DIR__.'/_lib/r2_storage.php';
require_once __DIR__.'/_lib/takeaway_print_downloads.php';
$downloads=takeaway_print_downloads();
$format=strtolower(trim((string)($_GET['format']??'exe')));
if(!isset($downloads[$format])){http_response_code(400);header('Content-Type: text/plain; charset=utf-8');echo 'Định dạng tải xuống không hợp lệ.';exit;}
$read=static function(string $key,string $env):string {global $config;$value=getenv($env);return trim((string)($value!==false&&trim($value)!==''?$value:($config[$key]??'')));};
$endpoint=$read('r2_endpoint','R2_ENDPOINT');$account=$read('r2_account_id','R2_ACCOUNT_ID');
if($endpoint==='' && $account!=='')$endpoint='https://'.$account.'.r2.cloudflarestorage.com';
$storage=new R2Storage($endpoint,$read('r2_bucket','R2_BUCKET'),$read('r2_access_key_id','R2_ACCESS_KEY_ID'),$read('r2_secret_access_key','R2_SECRET_ACCESS_KEY'));
$file=$downloads[$format];header('Cache-Control: no-store');header('Content-Type: '.$file['type']);
header('Content-Disposition: attachment; filename="'.$file['file'].'"');header('Location: '.$storage->presignedGetUrl($file['key'],900),true,302);exit;
