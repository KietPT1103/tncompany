<?php
declare(strict_types=1);
require __DIR__.'/../public/api/_lib/kitchen_reconciliation.php';
function check(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
$input=['from'=>'2026-10-12','to'=>'2026-10-18','stock'=>[['name'=>'Bò','unit'=>'kg','opening'=>10,'moves'=>[['date'=>'2026-10-12','received'=>0,'issued'=>2],['date'=>'2026-10-18','received'=>0,'issued'=>0]]]],'recipes'=>[['id'=>'r','name'=>'Lẩu','source'=>'Cost','lines'=>[['name'=>'Bắp bò','quantity'=>120,'unit'=>'g','kind'=>'ingredient']]]],'sales'=>[['code'=>'SP1','name'=>'Lẩu','quantity'=>10]],'saleRules'=>['SP1'=>['recipeId'=>'r']],'rules'=>['bap bo'=>['stockName'=>'Bò','stage'=>'raw']],'stockRules'=>['Bò'=>['confirmed'=>true,'yield'=>.8]]];
$r=kitchen_report($input);check(!$r['problems'],'Valid report blocked');check(abs($r['rows'][0]['theoretical']-1.2)<.00001,'Raw consumption wrong');check($r['rows'][0]['actual']===null,'Missing counts must not become zero');
$input['counts']=['Bò'=>['rawOpen'=>0,'rawClose'=>0,'preparedOpen'=>0,'preparedClose'=>.4]];
check(abs(kitchen_report($input)['rows'][0]['actual']-1.5)<.00001,'Prepared balance wrong');
$input['recipes'][0]['lines'][0]['unit']='viên';check(count(kitchen_report($input)['problems'])>0,'Conversion must block');
$dir=sys_get_temp_dir().DIRECTORY_SEPARATOR.'kitchen-test-'.bin2hex(random_bytes(8));mkdir($dir);
try { $id='report-'.str_repeat('a',32);kitchen_store_record($dir,$id,['value'=>1],true);$blocked=false;try{kitchen_store_record($dir,$id,['value'=>2],true);}catch(RuntimeException $e){$blocked=true;}check($blocked,'Snapshot overwritten');check(json_decode(file_get_contents($dir.'/'.$id.'.json'),true)['value']===1,'Snapshot changed');$blocked=false;try{kitchen_store_record($dir,'../escape',[],true);}catch(InvalidArgumentException $e){$blocked=true;}check($blocked,'Traversal accepted'); }
finally {foreach(glob($dir.'/*')?:[] as $f)unlink($f);if(file_exists($dir.'/.lock'))unlink($dir.'/.lock');rmdir($dir);}
echo "PASS PHP: raw/prepared accounting, missing counts, conversion gate, immutable snapshot, path safety.\n";

