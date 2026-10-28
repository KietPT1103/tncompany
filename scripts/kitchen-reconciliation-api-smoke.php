<?php
declare(strict_types=1);
require __DIR__.'/../public/api/_lib/bootstrap.php';
require __DIR__.'/../public/api/_lib/auth.php';
require __DIR__.'/../public/api/_lib/kitchen_reconciliation.php';
$base=rtrim(getenv('TN_KITCHEN_TEST_BASE')?:'http://127.0.0.1:8000','/');
if(!preg_match('#^http://(127\.0\.0\.1|localhost)(:\d+)?$#D',$base))throw new RuntimeException('Smoke test is restricted to localhost.');
$user=auth_find_user_for_login('admin');if(!$user)throw new RuntimeException('Local admin not found');
$token=auth_issue_token((string)$user['id']);$created=[];
function probe(string $method,string $query,?array $body=null,bool $auth=true): array {
    global $base,$token;
    $headers="Content-Type: application/json\r\n".($auth?'Authorization: Bearer '.$token."\r\n":'');
    $ctx=stream_context_create(['http'=>['method'=>$method,'header'=>$headers,'content'=>$body?json_encode($body):'','ignore_errors'=>true,'timeout'=>15]]);
    $raw=file_get_contents($base.'/api/kitchen-reconciliation.php?'.$query,false,$ctx);
    preg_match('/\s(\d{3})\s/',$http_response_header[0]??'',$m);
    return [(int)($m[1]??0),json_decode((string)$raw,true)];
}
function ensure(bool $v,string $m): void {if(!$v)throw new RuntimeException($m);}
try {
    ensure(probe('GET','storeId=restaurant&action=list',null,false)[0]===401,'Unauthenticated request not denied');
    ensure(probe('GET','storeId=cafe&action=list')[0]===403,'Cafe request not denied');
    ensure(probe('GET','storeId=farm&action=config')[0]===403,'Farm request not denied');
    ensure(probe('GET','storeId=restaurant&action=config')[0]===200,'Cannot load config');
    $input=['from'=>'2026-10-12','to'=>'2026-10-18','stock'=>[['name'=>'TEST_Beef','unit'=>'kg','opening'=>10,'moves'=>[['date'=>'2026-10-12','received'=>0,'issued'=>2],['date'=>'2026-10-18','received'=>0,'issued'=>0]]]],'recipes'=>[['id'=>'test','name'=>'TEST_Dish','source'=>'Smoke fixture','lines'=>[['kind'=>'ingredient','name'=>'TEST_Beef','quantity'=>120,'unit'=>'g']]]],'sales'=>[['code'=>'TEST1','name'=>'TEST_Dish','quantity'=>10]],'rules'=>['test_beef'=>['stockName'=>'TEST_Beef','stage'=>'raw']],'saleRules'=>['TEST1'=>['recipeId'=>'test']],'stockRules'=>['TEST_Beef'=>['confirmed'=>true,'baseStage'=>'raw']],'salesPeriod'=>['from'=>'2026-10-12','to'=>'2026-10-18'],'sources'=>[]];
    foreach(['recipe','stock','sales'] as $k)$input['sources'][$k]=['name'=>'synthetic-smoke-'.$k,'sha256'=>str_repeat('a',64)];
    $invalid=$input;$invalid['rules']=[];
    ensure(probe('POST','',['storeId'=>'restaurant','action'=>'finalize','input'=>$invalid])[0]===422,'Server accepted missing mapping');
    [$status,$response]=probe('POST','',['storeId'=>'restaurant','action'=>'finalize','input'=>$input,'report'=>['rows'=>[['theoretical'=>999]]]]);
    ensure($status===200,'Finalize failed: '.json_encode($response));$first=$response['data']['snapshot'];$created[]=$first['id'];
    ensure(abs($first['report']['rows'][0]['theoretical']-1.2)<.0001,'Server did not recompute');
    ensure($first['report']['rows'][0]['actual']===null,'Server fabricated zero inventory');
    $input['recipes'][0]['lines'][0]['quantity']=200;
    [$status,$response]=probe('POST','',['storeId'=>'restaurant','action'=>'finalize','input'=>$input,'parentId'=>$first['id']]);
    ensure($status===200,'Revision failed');$second=$response['data']['snapshot'];$created[]=$second['id'];
    ensure($second['parentId']===$first['id'] && $second['id']!==$first['id'],'Revision must create new ID');
    [$status,$response]=probe('GET','storeId=restaurant&action=get&id='.$first['id']);
    ensure($status===200 && abs($response['data']['snapshot']['report']['rows'][0]['theoretical']-1.2)<.0001,'Original snapshot changed');
    ensure(probe('GET','storeId=restaurant&action=get&id=../config')[0]===422,'Traversal not rejected');
    echo "PASS API: auth, restaurant-only access, source validation, server calculation, incomplete inventory, immutable revisions.\n";
} finally {
    auth_delete_token($token);
    $dir=kitchen_private_dir((string)$config['private_storage_path']);
    foreach($created as $id)if(preg_match('/^report-[a-f0-9]{32}$/D',$id))unlink($dir.DIRECTORY_SEPARATOR.$id.'.json');
}
