<?php
declare(strict_types=1);

function kitchen_key(string $value): string {
    $value = str_replace(['đ','Đ'], ['d','D'], $value);
    if (class_exists('Normalizer')) $value=(string)preg_replace('/\p{Mn}/u','',Normalizer::normalize($value,Normalizer::FORM_D));
    else {
        foreach (['a'=>'àáạảãâầấậẩẫăằắặẳẵÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴ','e'=>'èéẹẻẽêềếệểễÈÉẸẺẼÊỀẾỆỂỄ','i'=>'ìíịỉĩÌÍỊỈĨ','o'=>'òóọỏõôồốộổỗơờớợởỡÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠ','u'=>'ùúụủũưừứựửữÙÚỤỦŨƯỪỨỰỬỮ','y'=>'ỳýỵỷỹỲÝỴỶỸ'] as $plain=>$chars) $value=str_replace(preg_split('//u',$chars,-1,PREG_SPLIT_NO_EMPTY),$plain,$value);
    }
    return strtolower(trim((string) preg_replace('/\s+/', ' ', $value)));
}
function kitchen_num($value): ?float {
    if ($value === null || $value === '' || is_bool($value) || !is_numeric($value)) return null;
    $n = (float) $value;
    return is_finite($n) && abs($n) <= 1000000000 ? $n : null;
}
function kitchen_unit(string $value): string {
    $u = kitchen_key($value);
    return ['gam'=>'g','gram'=>'g','gr'=>'g','kilogram'=>'kg','lit'=>'l','liter'=>'l','qua'=>'cai','cay'=>'cai'][$u] ?? $u;
}
function kitchen_factor(string $from, string $to): ?float {
    $a=kitchen_unit($from); $b=kitchen_unit($to);
    if ($a === '' || $b === '') return null;
    if ($a === $b) return 1;
    $units=['g'=>['mass',.001],'kg'=>['mass',1.0],'ml'=>['volume',.001],'l'=>['volume',1.0]];
    return isset($units[$a],$units[$b]) && $units[$a][0] === $units[$b][0] ? $units[$a][1]/$units[$b][1] : null;
}
function kitchen_date($value): bool {
    if (!is_string($value)) return false;
    $d=DateTimeImmutable::createFromFormat('!Y-m-d',$value);
    return $d && $d->format('Y-m-d') === $value;
}
function kitchen_report(array $input): array {
    $from=$input['from']??''; $to=$input['to']??'';
    if (!kitchen_date($from)||!kitchen_date($to)||$from>$to) throw new InvalidArgumentException('Khoảng ngày không hợp lệ.');
    $stock=$input['stock']??[]; $sales=$input['sales']??[]; $recipes=$input['recipes']??[];
    if (!is_array($stock)||!is_array($sales)||!is_array($recipes)||!count($stock)||!count($sales)||!count($recipes)||count($stock)>500||count($sales)>5000||count($recipes)>1000) throw new InvalidArgumentException('Dữ liệu báo cáo thiếu hoặc quá lớn.');
    $problems=[]; $rows=[]; $skipped=[]; $outside=[]; $recipeMap=[];
    foreach ($recipes as $recipe) {
        if (!is_string($recipe['id']??null)||isset($recipeMap[$recipe['id']])||!is_array($recipe['lines']??null)||count($recipe['lines'])>500) throw new InvalidArgumentException('Công thức không hợp lệ hoặc trùng mã.');
        $recipeMap[$recipe['id']]=$recipe;
    }
    foreach ($stock as $s) {
        $name=$s['name']??'';
        if (!is_string($name)||$name===''||isset($rows[$name])||!is_string($s['unit']??null)||!is_array($s['moves']??null)||count($s['moves'])>4000||kitchen_num($s['opening']??null)===null) throw new InvalidArgumentException('Dòng kho không hợp lệ.');
        $opening=(float)$s['opening']; $received=0.; $issued=0.; $adj=[]; $wa=0.; $ka=0.;
        $dates=array_column($s['moves'],'date');sort($dates);
        if(count($dates) && ($from<$dates[0]||$to>$dates[count($dates)-1]))$problems[]="$name: file kho chưa bao phủ đủ kỳ PDF.";
        foreach ($s['moves'] as $m) {
            if (!kitchen_date($m['date']??null)||kitchen_num($m['received']??null)===null||kitchen_num($m['issued']??null)===null||$m['received']<0||$m['issued']<0) throw new InvalidArgumentException('Ngày hoặc số lượng nhập–xuất không hợp lệ.');
            if ($m['date']<$from) $opening+=(float)$m['received']-(float)$m['issued'];
            elseif ($m['date']<=$to) { $received+=(float)$m['received']; $issued+=(float)$m['issued']; }
        }
        foreach ($input['adjustments']??[] as $a) {
            if (!kitchen_date($a['date']??null)||kitchen_num($a['quantity']??null)===null||!trim((string)($a['reason']??''))||!in_array($a['location']??'',['warehouse','kitchen'],true)) throw new InvalidArgumentException('Điều chỉnh cần ngày, số lượng, vị trí và lý do.');
            if (($a['stockName']??'')!==$name) continue;
            if ($a['date']<$from && $a['location']==='warehouse') $opening+=(float)$a['quantity'];
            elseif ($a['date']>=$from && $a['date']<=$to) { $adj[]=$a; if ($a['location']==='warehouse') $wa+=(float)$a['quantity']; else $ka+=(float)$a['quantity']; }
        }
        $rule=$input['stockRules'][$name]??[]; $yield=kitchen_num($rule['yield']??null);$baseStage=$rule['baseStage']??'raw';
        if(!in_array($baseStage,['raw','prepared'],true))$problems[]="$name: trạng thái kho không hợp lệ.";
        if (($rule['confirmed']??false)!==true) $problems[]="$name: chưa xác nhận cấu hình kho.";
        $count=$input['counts'][$name]??[]; $complete=true;
        foreach (['rawOpen','rawClose','preparedOpen','preparedClose'] as $k) {
            $n=kitchen_num($count[$k]??null); if ($n===null) $complete=false;
            if(isset($count[$k])&&$count[$k]!==''&&$n===null)$problems[]="$name: kiểm kê không hợp lệ.";
            if ($n!==null && $n<0) $problems[]="$name: kiểm kê phải không âm.";
        }
        $bi=0.;$bo=0.;$hasBatch=false;
        foreach ($input['batches']??[] as $b) {
            if (!kitchen_date($b['date']??null)||kitchen_num($b['input']??null)===null||kitchen_num($b['output']??null)===null||$b['input']<=0||$b['output']<=0||$b['output']>$b['input']) throw new InvalidArgumentException('Mẻ sơ chế cần ngày và 0 < đầu ra ≤ đầu vào.');
            if (($b['stockName']??'')===$name && $b['date']>=$from && $b['date']<=$to) {$bi+=(float)$b['input'];$bo+=(float)$b['output'];$hasBatch=true;}
        }
        $needsYield=($baseStage==='raw'?(($count['preparedOpen']??0)>0||($count['preparedClose']??0)>0):(($count['rawOpen']??0)>0||($count['rawClose']??0)>0))||$hasBatch;
        $validYield=$yield!==null && $yield>0 && $yield<=1;
        if ($needsYield&&!$validYield) $problems[]="$name: thiếu tỷ lệ thu hồi chuẩn.";
        $eq=static fn($raw,$prepared)=>$baseStage==='raw'?$raw+$prepared/($yield?:1):$raw*($yield?:1)+$prepared;
        $actual=$complete&&(!$needsYield||$validYield)?$eq((float)$count['rawOpen'],(float)$count['preparedOpen'])+$issued+$ka-$eq((float)$count['rawClose'],(float)$count['preparedClose']):null;
        $rows[$name]=array_merge($s,['baseStage'=>$baseStage,'warehouseOpening'=>$opening,'received'=>$received,'issued'=>$issued,'warehouseAdjustment'=>$wa,'kitchenAdjustment'=>$ka,'warehouseClosing'=>$opening+$received-$issued+$wa,'theoretical'=>0.,'actual'=>$actual,'variance'=>null,'processingVariance'=>$hasBatch&&$validYield?($baseStage==='raw'?$bi-$bo/$yield:$bi*$yield-$bo):0.,'batchInput'=>$bi,'batchOutput'=>$bo,'yieldRatio'=>$yield,'estimated'=>$needsYield,'count'=>$count,'adjustments'=>$adj,'details'=>[]]);
    }
    $budget=50000;
    $expand=function($id,float $mult,array $sale,array $path=[]) use (&$expand,&$problems,&$rows,&$outside,$recipeMap,$input,&$budget): void {
        if(--$budget<0)throw new InvalidArgumentException('Combo quá lớn; cần giảm số dòng hoặc tầng thành phần.');
        if (in_array($id,$path,true)||count($path)>20) {$problems[]='Vòng lặp hoặc combo quá sâu.';return;}
        $recipe=$recipeMap[$id??'']??null;
        if (!$recipe || !count($recipe['lines'])) {$problems[]=($sale['name']??'Món').': thiếu công thức.';return;}
        foreach ($recipe['lines'] as $line) {
            $q=kitchen_num($line['quantity']??null);
            if (($line['kind']??'ingredient')==='recipe') {if ($q===null||$q<=0) {$problems[]='Số phần món con không hợp lệ.';continue;} $expand($line['recipeId']??null,$mult*$q,$sale,[...$path,$id]);continue;}
            $ingredient=(string)($line['name']??'');$rule=$input['rules'][kitchen_key($ingredient)]??[];
            if (($rule['excluded']??false)===true) {if(!trim((string)($rule['reason']??'')))$problems[]="$ingredient: cần lý do loại.";else $outside[$ingredient]=['name'=>$ingredient,'reason'=>$rule['reason']];continue;}
            $name=$rule['stockName']??'';
            if (!isset($rows[$name])) {$problems[]="$ingredient: chưa ghép nguyên liệu kho.";continue;}
            if ($q===null||$q<=0||!in_array($rule['stage']??'',['raw','prepared'],true)) {$problems[]="$ingredient: thiếu định lượng hoặc trạng thái sơ chế.";continue;}
            $factor=kitchen_factor((string)($line['unit']??''),$rows[$name]['unit'])??kitchen_num($rule['factors'][kitchen_unit((string)($line['unit']??''))]??null);
            if ($factor===null||$factor<=0) {$problems[]="$ingredient: thiếu hệ số quy đổi.";continue;}
            $cross=$rule['stage']!==$rows[$name]['baseStage'];$yield=$cross?$rows[$name]['yieldRatio']:1.;
            if (!$yield||$yield<=0||$yield>1) {$problems[]="$ingredient: thiếu tỷ lệ sơ chế.";continue;}
            $stageFactor=!$cross?1.:($rule['stage']==='prepared'?1/$yield:$yield);$total=$mult*$q*$factor*$stageFactor;
            $rows[$name]['theoretical']+=$total;$rows[$name]['estimated']=$rows[$name]['estimated']||$cross;
            $rows[$name]['details'][]=['stockName'=>$name,'code'=>$sale['code'],'saleName'=>$sale['name'],'sold'=>$sale['quantity'],'recipeName'=>$recipe['name'],'source'=>$recipe['source']??'Nhập tay','ingredient'=>$ingredient,'quantity'=>$q,'unit'=>$line['unit']??'','portions'=>$mult,'stage'=>$rule['stage'],'factor'=>$factor,'yieldRatio'=>$yield,'stageFactor'=>$stageFactor,'total'=>$total];
        }
    };
    $saleCodes=[];
    foreach ($sales as $sale) {
        if (!is_string($sale['code']??null)||isset($saleCodes[$sale['code']])||kitchen_num($sale['quantity']??null)===null||$sale['quantity']<0) throw new InvalidArgumentException('Mã hoặc số lượng bán không hợp lệ.');
        $saleCodes[$sale['code']]=true;$rule=$input['saleRules'][$sale['code']]??[];
        if(($rule['confirmed']??null)===false)$problems[]='Cần xác nhận ghép món gợi ý.';
        if (($rule['skip']??false)===true) {if(!trim((string)($rule['reason']??'')))$problems[]='Món bỏ qua cần lý do.';$skipped[]=array_merge($sale,['reason'=>$rule['reason']??'']);continue;}
        $expand($rule['recipeId']??null,(float)$sale['quantity'],$sale);
    }
    foreach ($rows as &$r) {$r['theoretical']=round($r['theoretical'],9);$r['variance']=$r['actual']===null?null:$r['actual']-$r['theoretical'];}unset($r);
    return ['rows'=>array_values($rows),'problems'=>array_values(array_unique($problems)),'skipped'=>$skipped,'outside'=>array_values($outside),'from'=>$from,'to'=>$to,'warnings'=>['Chênh lệch chưa giải thích có thể gồm sử dụng ngoài bán hàng; không kết luận thất thoát.','Tồn kho không phải tồn tại bếp. Tồn đã sơ chế quy đổi theo tỷ lệ chuẩn; sai lệch mẻ cân được trình bày riêng.']];
}

function kitchen_private_dir(string $root): string {
    $public=realpath(dirname(__DIR__,2));
    if (!is_dir($root) && !mkdir($root,0700,true) && !is_dir($root)) throw new RuntimeException('Không tạo được vùng lưu riêng tư.');
    $resolved=realpath($root);
    if (!$resolved || ($public && (strtolower($resolved)===strtolower($public)||str_starts_with(strtolower($resolved),strtolower($public).DIRECTORY_SEPARATOR)))) throw new RuntimeException('Vùng lưu báo cáo phải nằm ngoài public.');
    $dir=$resolved.DIRECTORY_SEPARATOR.'kitchen-reconciliation';
    if (!is_dir($dir) && !mkdir($dir,0700,true) && !is_dir($dir)) throw new RuntimeException('Không tạo được vùng lưu báo cáo.');
    return $dir;
}
function kitchen_store_record(string $dir,string $id,array $record,bool $immutable=false): void {
    if (!preg_match('/^(config|(?:report|recipe)-[a-f0-9]{32})$/D',$id)) throw new InvalidArgumentException('Mã báo cáo không hợp lệ.');
    $path=$dir.DIRECTORY_SEPARATOR.$id.'.json';
    $lock=fopen($dir.DIRECTORY_SEPARATOR.'.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('Không khóa được vùng lưu.');
    try {
        if($immutable&&file_exists($path))throw new RuntimeException('Báo cáo đã chốt không được ghi đè.');
        $temp=tempnam($dir,'write-');
        if(!$temp)throw new RuntimeException('Không tạo được file lưu.');
        try {if(file_put_contents($temp,json_encode($record,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),LOCK_EX)===false||!rename($temp,$path))throw new RuntimeException('Không lưu được báo cáo.');}finally{if(file_exists($temp))unlink($temp);}
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
