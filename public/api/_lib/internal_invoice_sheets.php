<?php
declare(strict_types=1);

const INTERNAL_SHEETS_DEFAULT_ID = '1XwdmXbGZwXo3-cSPg-WgzkrcJ_HfCQ1aD1bP2xNDIdY';

function internal_sheets_id(): string {
    $id=trim((string)(getenv('INTERNAL_INVOICE_SPREADSHEET_ID') ?: INTERNAL_SHEETS_DEFAULT_ID));
    if (!preg_match('/^[A-Za-z0-9_-]{10,160}$/D',$id)) throw new RuntimeException('Mã Google Sheet không hợp lệ.');
    return $id;
}
function internal_sheets_bill_url(string $value): string {
    $value=trim($value);
    if (strlen($value)>500 || preg_match('/[\x00-\x20]/',$value)) throw new InvalidArgumentException('Link bill không hợp lệ hoặc vượt quá 500 ký tự.');
    $u=parse_url($value);
    if (!$u || ($u['scheme'] ?? '')!=='https' || empty($u['host']) || isset($u['user']) || isset($u['pass']) || isset($u['port'])) throw new InvalidArgumentException('Link bill phải là liên kết HTTPS.');
    if (strtolower($u['host'])==='drive.google.com') {
        if(preg_match('~^/drive/(?:u/\d+/)?folders/([A-Za-z0-9_-]+)(?:/|$)~',$u['path'] ?? '',$m))return 'https://drive.google.com/drive/folders/'.$m[1];
        $id=null;
        if (preg_match('~^/file/d/([A-Za-z0-9_-]+)(?:/|$)~',$u['path'] ?? '',$m)) $id=$m[1];
        if (in_array($u['path'] ?? '',['/open','/uc'],true)) {parse_str($u['query'] ?? '',$q);$id=$q['id'] ?? null;}
        if (is_string($id) && preg_match('/^[A-Za-z0-9_-]+$/D',$id)) return 'https://drive.google.com/file/d/'.$id.'/view';
    }
    return $value;
}
function internal_sheets_number(string $value): float {
    $value=preg_replace('/[\s\x{00A0}]+/u','',trim($value));
    if (preg_match('/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/D',$value)) $value=str_replace(',','.',str_replace('.','',$value));
    elseif (preg_match('/^\d+(?:,\d+)?$/D',$value)) $value=str_replace(',','.',$value);
    elseif (!preg_match('/^\d+(?:\.\d+)?$/D',$value)) throw new InvalidArgumentException('Số lượng/đơn giá phải là số lớn hơn 0.');
    $number=(float)$value;
    if (!is_finite($number) || $number<=0 || $number>999999999999) throw new InvalidArgumentException('Số lượng/đơn giá phải lớn hơn 0 và trong giới hạn cho phép.');
    return $number;
}
function internal_sheets_date(string $value): string {
    foreach (['!d/m/Y','!Y-m-d'] as $format) {
        $d=DateTimeImmutable::createFromFormat($format,trim($value));$errors=DateTimeImmutable::getLastErrors();
        if ($d && (!$errors || (!$errors['warning_count'] && !$errors['error_count']))) return $d->format('Y-m-d');
    }
    throw new InvalidArgumentException('Ngày nhập không hợp lệ (dd/mm/yyyy).');
}
function internal_sheets_item(string $name,string $quantity,string $unit,string $price): array {
    $number=round(internal_sheets_number($quantity),3);$amount=round(internal_sheets_number($price),2);
    if($number<=0 || $amount<=0)throw new InvalidArgumentException('Số lượng cần tối thiểu 0,001; đơn giá cần tối thiểu 0,01.');
    $length=fn($text)=>function_exists('mb_strlen')?mb_strlen($text,'UTF-8'):strlen($text);
    if($length($name)>255 || $length($unit)>50)throw new InvalidArgumentException('Tên vật tư tối đa 255 ký tự, đơn vị tối đa 50 ký tự.');
    if($number*$amount>9999999999999.0)throw new InvalidArgumentException('Thành tiền vượt giới hạn cho phép.');
    return ['name'=>$name,'quantity'=>$number,'unit'=>$unit,'unitPrice'=>$amount];
}
function internal_sheets_csv(string $csv): array {
    if (strlen($csv)>2097152 || str_contains(strtolower(substr($csv,0,500)),'<html')) throw new InvalidArgumentException('Không đọc được dữ liệu CSV của Sheet.');
    $f=fopen('php://temp','r+');fwrite($f,preg_replace('/^\xEF\xBB\xBF/','',$csv));rewind($f);$rows=[];
    while (($row=fgetcsv($f))!==false) {if(count($rows)>=1000) {fclose($f);throw new InvalidArgumentException('Tab vượt quá 1000 dòng.');}$rows[]=$row;}
    fclose($f);return $rows;
}
/** Parse all weekly tabs together: a bad row quarantines its bill, never creates a partial invoice. */
function internal_sheets_parse(array $tabs): array {
    $groups=[];$errors=[];$blockedUrls=[];$blockedDates=[];$unassigned=false;
    foreach($tabs as $tab=>$csv) {
        $rows=internal_sheets_csv($csv);$header=array_map('trim',array_shift($rows) ?? []);
        $required=['Ngày nhập','Loại vật tư','Số lượng','Đơn vị','Nguồn cung','Đơn giá','Link bill'];$cols=[];
        foreach($required as $name) {$index=array_search($name,$header,true);if($index===false)throw new InvalidArgumentException('Tab '.$tab.': thiếu cột '.$name.'.');$cols[$name]=$index;}
        foreach($rows as $index=>$row) {
            if (!array_filter($row,fn($v)=>trim((string)$v)!=='')) continue;
            $get=fn($name)=>trim((string)($row[$cols[$name]] ?? ''));
            // Formula-only rows can have a unit or total; an entirely empty material row is still reported if other input exists.
            $location=$tab.' · dòng '.($index+2);$url='';$key=null;
            try {
                $url=internal_sheets_bill_url($get('Link bill'));
                $date=internal_sheets_date($get('Ngày nhập'));
                $key=hash('sha256',$date.'|'.$url);
                if(!isset($groups[$key]))$groups[$key]=['sourceKey'=>$key,'invoiceDate'=>$date,'billUrl'=>$url,'partnerName'=>$get('Nguồn cung'),'items'=>[],'locations'=>[],'invalid'=>false];
                $groups[$key]['locations'][]=$location;
                if($get('Loại vật tư')==='' || $get('Nguồn cung')==='')throw new InvalidArgumentException('Thiếu vật tư hoặc nguồn cung.');
                if((function_exists('mb_strlen')?mb_strlen($get('Nguồn cung'),'UTF-8'):strlen($get('Nguồn cung')))>255)throw new InvalidArgumentException('Nguồn cung tối đa 255 ký tự.');
                if($groups[$key]['partnerName']!==$get('Nguồn cung'))throw new InvalidArgumentException('Cùng bill có nhiều nguồn cung khác nhau.');
                $extraColumn=array_search('Phát sinh',$header,true);
                $extra=$extraColumn===false?'':trim((string)($row[$extraColumn] ?? ''));
                $groups[$key]['items'][]=internal_sheets_item($get('Loại vật tư'),$get('Số lượng'),$get('Đơn vị'),$get('Đơn giá'));
                if($extra!=='' && !preg_match('/^0+(?:[,.]0+)?$/D',$extra))$groups[$key]['items'][]=internal_sheets_item('Phát sinh – '.$get('Loại vật tư'),'1','khoản',$extra)+['categoryName'=>'Chi phí phát sinh'];
            } catch(InvalidArgumentException $e) {
                $errors[]=$location.': '.$e->getMessage();
                if($key!==null)$groups[$key]['invalid']=true;
                elseif($url!=='')$blockedUrls[$url]=true;
                else {try{$blockedDates[internal_sheets_date($get('Ngày nhập'))]=true;}catch(InvalidArgumentException $_){$unassigned=true;}}
            }
        }
    }
    $bills=[];
    foreach($groups as $group) {
        if($unassigned || $group['invalid'] || isset($blockedUrls[$group['billUrl']]) || isset($blockedDates[$group['invoiceDate']]) || !$group['items'])continue;
        if(array_sum(array_map(fn($item)=>round($item['quantity']*$item['unitPrice'],2),$group['items']))>9999999999999.0){$errors[]=implode(', ',$group['locations']).': Tổng bill vượt giới hạn cho phép.';continue;}
        unset($group['invalid']);$bills[]=$group;
    }
    return ['bills'=>$bills,'errors'=>$errors];
}
function internal_sheets_source_hash(array $bill): string {
    $items=array_map(fn($item)=>json_encode($item,JSON_UNESCAPED_UNICODE|JSON_PRESERVE_ZERO_FRACTION),$bill['items']);sort($items,SORT_STRING);
    return hash('sha256',json_encode([$bill['invoiceDate'],$bill['billUrl'],$bill['partnerName'],$items],JSON_UNESCAPED_UNICODE));
}
function internal_sheets_load(?callable $fetch=null): array {
    $fetch=$fetch ?? 'outside_expenses_fetch';
    $base='https://docs.google.com/spreadsheets/d/'.internal_sheets_id().'/gviz/tq?';
    $read=fn($tab)=>$fetch($base.http_build_query(['tqx'=>'out:csv','sheet'=>$tab]));
    $registry=internal_sheets_csv($read('Danh sách tuần'));
    if(trim((string)($registry[0][0] ?? ''))!=='Tên tab tuần')throw new RuntimeException('Tab Danh sách tuần thiếu cột Tên tab tuần.');
    $tabs=[];
    foreach(array_slice($registry,1) as $row){$name=trim((string)($row[0] ?? ''));if($name==='')continue;if(in_array($name,['Loại vật tư','Nhà cung cấp','Danh sách tuần','MẪU NHẬP BILL TUẦN'],true))throw new RuntimeException('Danh sách tuần chứa tab không phải dữ liệu tuần.');$tabs[$name]=true;}
    if(count($tabs)>100)throw new RuntimeException('Tối đa 100 tab tuần mỗi lần đồng bộ.');
    foreach($tabs as $tab=>$_)$tabs[$tab]=$read($tab);
    return internal_sheets_parse($tabs)+['tabs'=>count($tabs)];
}
