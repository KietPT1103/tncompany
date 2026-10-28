<?php
declare(strict_types=1);
require_once __DIR__.'/_lib/bootstrap.php';
require_once __DIR__.'/_lib/auth.php';
require_once __DIR__.'/_lib/field_inventory.php';
require_once __DIR__.'/_lib/kitchen_reconciliation.php';

$user=auth_require(['admin']);
$method=$_SERVER['REQUEST_METHOD']??'GET';
if(!in_array($method,['GET','POST'],true))respond_error('Method not allowed',405);
if((int)($_SERVER['CONTENT_LENGTH']??0)>6000000)respond_error('Dữ liệu quá lớn (tối đa 6 MB).',413);
$body=$_GET;
if($method==='POST'){
    $raw=file_get_contents('php://input',false,null,0,6000001);
    if($raw===false||strlen($raw)>6000000)respond_error('Dữ liệu quá lớn (tối đa 6 MB).',413);
    try{$body=json_decode($raw,true,64,JSON_THROW_ON_ERROR);}catch(JsonException $e){respond_error('JSON không hợp lệ.',422);}
    if(!is_array($body))respond_error('Dữ liệu không hợp lệ.',422);
}
$store=trim((string)($body['storeId']??''));
if($store!=='restaurant')respond_error('Module này chỉ dành cho Lẩu/Bếp.',403);
field_inventory_require_store($user,$store);

try {
    $dir=kitchen_private_dir((string)$config['private_storage_path']);
    $action=$body['action']??'list';
    if($method==='GET' && $action==='config'){
        $file=$dir.DIRECTORY_SEPARATOR.'config.json';
        respond_ok(['config'=>is_file($file)?json_decode((string)file_get_contents($file),true,64,JSON_THROW_ON_ERROR):null]);
    }
    if($method==='GET' && $action==='versions'){
        $items=[];
        foreach(glob($dir.DIRECTORY_SEPARATOR.'recipe-*.json')?:[] as $file){$r=json_decode((string)file_get_contents($file),true,64,JSON_THROW_ON_ERROR);$items[]=['id'=>$r['versionId'],'updatedAt'=>$r['updatedAt'],'source'=>$r['recipeSource']['name']??'Nhập tay'];}
        usort($items,static fn($a,$b)=>strcmp($b['updatedAt'],$a['updatedAt']));respond_ok(['items'=>array_slice($items,0,100)]);
    }
    if($method==='GET' && $action==='version'){
        $id=(string)($body['id']??'');if(!preg_match('/^recipe-[a-f0-9]{32}$/D',$id))respond_error('Mã phiên bản không hợp lệ.',422);
        $file=$dir.DIRECTORY_SEPARATOR.$id.'.json';if(!is_file($file))respond_error('Không tìm thấy phiên bản.',404);
        respond_ok(['config'=>json_decode((string)file_get_contents($file),true,64,JSON_THROW_ON_ERROR)]);
    }
    if($method==='GET' && $action==='list'){
        $items=[];
        foreach(glob($dir.DIRECTORY_SEPARATOR.'report-*.json')?:[] as $file){
            $r=json_decode((string)file_get_contents($file),true,64,JSON_THROW_ON_ERROR);
            $items[]=['id'=>$r['id'],'from'=>$r['input']['from'],'to'=>$r['input']['to'],'createdAt'=>$r['createdAt'],'createdBy'=>$r['createdBy'],'parentId'=>$r['parentId']??null];
        }
        usort($items,static fn($a,$b)=>strcmp($b['createdAt'],$a['createdAt']));respond_ok(['items'=>array_slice($items,0,100)]);
    }
    if($method==='GET' && $action==='get'){
        $id=(string)($body['id']??'');if(!preg_match('/^report-[a-f0-9]{32}$/D',$id))respond_error('Mã báo cáo không hợp lệ.',422);
        $file=$dir.DIRECTORY_SEPARATOR.$id.'.json';if(!is_file($file))respond_error('Không tìm thấy báo cáo.',404);
        respond_ok(['snapshot'=>json_decode((string)file_get_contents($file),true,64,JSON_THROW_ON_ERROR)]);
    }
    if($method==='POST' && $action==='config'){
        $c=$body['config']??null;
        if(!is_array($c)||!is_array($c['recipes']??null)||count($c['recipes'])>1000)respond_error('Cấu hình không hợp lệ.',422);
        $record=['versionId'=>'recipe-'.bin2hex(random_bytes(16)),'recipes'=>$c['recipes'],'rules'=>$c['rules']??[],'saleRules'=>$c['saleRules']??[],'stockRules'=>$c['stockRules']??[],'recipeSource'=>$c['recipeSource']??null,'updatedAt'=>date(DATE_ATOM),'updatedBy'=>$user['id']];
        kitchen_store_record($dir,$record['versionId'],$record,true);kitchen_store_record($dir,'config',$record);respond_ok(['saved'=>true,'versionId'=>$record['versionId'],'updatedAt'=>$record['updatedAt']]);
    }
    if($method==='POST' && $action==='finalize'){
        $input=$body['input']??null;if(!is_array($input))respond_error('Thiếu dữ liệu báo cáo.',422);
        foreach(['stock','sales','recipe'] as $kind){$source=$input['sources'][$kind]??[];if(!is_string($source['name']??null)||!preg_match('/^[a-f0-9]{64}$/D',(string)($source['sha256']??'')))respond_error('Thiếu dấu vết file nguồn '.$kind,422);}
        $pdf=$input['salesPeriod']??[];
        if(($pdf['from']??null)!==($input['from']??null)||($pdf['to']??null)!==($input['to']??null))respond_error('Kỳ báo cáo phải khớp kỳ trong PDF bán hàng.',422);
        $report=kitchen_report($input);
        if(count($report['problems']))respond_error('Chưa thể chốt: '.$report['problems'][0],422,['problems'=>$report['problems']]);
        $id='report-'.bin2hex(random_bytes(16));
        $snapshot=['id'=>$id,'storeId'=>'restaurant','createdAt'=>date(DATE_ATOM),'createdBy'=>$user['displayName']??$user['username']??$user['id'],'parentId'=>null,'input'=>$input,'report'=>$report];
        if(!empty($body['parentId'])){
            $parent=(string)$body['parentId'];if(!preg_match('/^report-[a-f0-9]{32}$/D',$parent)||!is_file($dir.DIRECTORY_SEPARATOR.$parent.'.json'))respond_error('Báo cáo gốc không hợp lệ.',422);$snapshot['parentId']=$parent;
        }
        kitchen_store_record($dir,$id,$snapshot,true);respond_ok(['snapshot'=>$snapshot]);
    }
    respond_error('Không tìm thấy thao tác.',404);
} catch(InvalidArgumentException $e){respond_error($e->getMessage(),422);}
catch(Throwable $e){error_log('Kitchen reconciliation: '.$e->getMessage());respond_error('Không lưu/đọc được báo cáo. Kiểm tra quyền ghi vùng lưu riêng tư của máy chủ.',500);}
