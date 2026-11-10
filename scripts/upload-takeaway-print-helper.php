<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
$options=getopt('',['bootstrap:','manifest:','artifact-dir:','helper-only','drivers-only']);
define('BOOTSTRAP_SKIP_DB',true);
$bootstrap=$options['bootstrap']??__DIR__.'/../public/api/_lib/bootstrap.php';
require_once $bootstrap;
set_exception_handler(static function(Throwable $error):void {fwrite(STDERR,$error->getMessage().PHP_EOL);exit(1);});
while(ob_get_level()>0)ob_end_flush();
require_once dirname($bootstrap).'/r2_storage.php';
require_once ($options['manifest']??__DIR__.'/../public/api/_lib/takeaway_print_downloads.php');
$read=static function(string $key,string $env):string {global $config;$v=getenv($env);return trim((string)($v!==false&&trim($v)!==''?$v:($config[$key]??'')));};
$endpoint=$read('r2_endpoint','R2_ENDPOINT');$account=$read('r2_account_id','R2_ACCOUNT_ID');
if($endpoint==='' && $account!=='')$endpoint='https://'.$account.'.r2.cloudflarestorage.com';
$storage=new R2Storage($endpoint,$read('r2_bucket','R2_BUCKET'),$read('r2_access_key_id','R2_ACCESS_KEY_ID'),$read('r2_secret_access_key','R2_SECRET_ACCESS_KEY'));
$directory=realpath($options['artifact-dir']??__DIR__.'/../artifacts');
if($directory===false)throw new RuntimeException('Artifact directory missing.');
$files=takeaway_print_downloads();$formats=['exe','zip','kv804-driver','365b-driver'];
if(isset($options['helper-only']))$formats=['exe','zip'];
if(isset($options['drivers-only']))$formats=['kv804-driver','365b-driver'];
foreach($formats as $format) {
    $path=$directory.DIRECTORY_SEPARATOR.$files[$format]['file'];
    if(!is_file($path)||!is_file($path.'.sha256'))throw new RuntimeException('Missing artifact or checksum: '.$files[$format]['file']);
    $expected=strtolower(substr(trim(file_get_contents($path.'.sha256')),0,64));
    if(!hash_equals($expected,hash_file('sha256',$path)))throw new RuntimeException('Local checksum mismatch: '.$format);
}
foreach($formats as $format) {
    $item=$files[$format];$path=$directory.DIRECTORY_SEPARATOR.$item['file'];
    echo 'Uploading '.$item['file'].PHP_EOL;flush();
    $storage->putFile($item['key'],$path,$item['type']);
    $storage->putFile($files[$format.'-sha256']['key'],$path.'.sha256','text/plain; charset=utf-8');
    $hash=hash_init('sha256');$curl=curl_init($storage->presignedGetUrl($item['key'],900));
    curl_setopt_array($curl,[CURLOPT_FOLLOWLOCATION=>true,CURLOPT_CONNECTTIMEOUT=>15,CURLOPT_TIMEOUT=>600,
        CURLOPT_WRITEFUNCTION=>static function($handle,string $chunk)use($hash):int{hash_update($hash,$chunk);return strlen($chunk);}]);
    $ok=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);$error=curl_error($curl);curl_close($curl);
    if($ok!==true||$status!==200)throw new RuntimeException('Download verification failed: '.($error?:'HTTP '.$status));
    if(!hash_equals(hash_file('sha256',$path),hash_final($hash)))throw new RuntimeException('Remote checksum mismatch: '.$item['file']);
    echo 'Verified '.$item['file'].PHP_EOL;flush();
}
