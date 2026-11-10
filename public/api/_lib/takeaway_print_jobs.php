<?php
declare(strict_types=1);

function takeaway_print_ensure_schema(PDO $pdo): void
{
    static $ready=[];
    $connection=spl_object_id($pdo); if(isset($ready[$connection])) return;
    $engine=$pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite'?'':' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    $pdo->exec("CREATE TABLE IF NOT EXISTS takeaway_print_jobs (
        id VARCHAR(64) PRIMARY KEY, store_id VARCHAR(64) NOT NULL, bill_id VARCHAR(100) NOT NULL,
        job_key VARCHAR(191) NOT NULL UNIQUE, kind VARCHAR(16) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending', document_json LONGTEXT NOT NULL,
        claim_token VARCHAR(64) NULL, terminal_name VARCHAR(255) NULL,
        error TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        queue_order BIGINT NOT NULL
    )$engine");
    $columns=$pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite'
        ? array_column($pdo->query('PRAGMA table_info(takeaway_print_jobs)')->fetchAll(PDO::FETCH_ASSOC),'name')
        : $pdo->query('SHOW COLUMNS FROM takeaway_print_jobs')->fetchAll(PDO::FETCH_COLUMN);
    if(!in_array('queue_order',$columns,true)) {
        try {$pdo->exec('ALTER TABLE takeaway_print_jobs ADD COLUMN queue_order BIGINT NOT NULL DEFAULT 0');}
        catch(PDOException $e) {if(($e->errorInfo[1]??0)!==1060) throw $e;}
    }
    foreach(['takeaway_queue_status'=>'store_id,status,kind,queue_order','takeaway_queue_bill'=>'store_id,bill_id'] as $name=>$columns) {
        try {$pdo->exec("CREATE INDEX $name ON takeaway_print_jobs ($columns)");}
        catch(PDOException $e) {if(($e->errorInfo[1]??0)!==1061 && !str_contains($e->getMessage(),'already exists')) throw $e;}
    }
    $ready[$connection]=true;
}

function takeaway_print_map(array $row): array
{
    return ['id'=>$row['id'],'billId'=>$row['bill_id'],'kind'=>$row['kind'],'status'=>$row['status'],
        'document'=>json_decode($row['document_json'],true,512,JSON_THROW_ON_ERROR),
        'error'=>$row['error']??'','terminalName'=>$row['terminal_name']??'','createdAt'=>$row['created_at']];
}

function takeaway_print_has_receipt(PDO $pdo,string $storeId,string $billId): bool
{
    $q=$pdo->prepare("SELECT id FROM takeaway_print_jobs WHERE store_id=? AND bill_id=? AND kind='receipt' LIMIT 1");
    $q->execute([$storeId,$billId]); return $q->fetchColumn()!==false;
}

function takeaway_print_insert(PDO $pdo,string $storeId,string $billId,string $key,string $kind,array $document,string $error=''): void
{
    $existing=$pdo->prepare('SELECT id FROM takeaway_print_jobs WHERE job_key=?'); $existing->execute([$key]);
    if($existing->fetchColumn()!==false) return;
    static $lastOrder=0;
    $lastOrder=max($lastOrder+1,(int)(microtime(true)*1000000));
    $pdo->prepare('INSERT INTO takeaway_print_jobs(id,store_id,bill_id,job_key,kind,status,document_json,error,queue_order) VALUES(?,?,?,?,?,?,?,?,?)')
        ->execute([bin2hex(random_bytes(16)),$storeId,$billId,$key,$kind,$error===''?'pending':'failed',
            json_encode($document,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$error,$lastOrder]);
}

/** Caller owns the bill transaction. Schema must be initialized before starting it. */
function takeaway_print_enqueue(PDO $pdo,array $store,array $bill): bool
{
    if(empty($store['isTakeAway']) || empty($store['takeawayPrintingEnabled']) || ($bill['status']??'completed')!=='completed') return false;
    $base=['storeName'=>$store['name'],'address'=>$store['address']??'','bill'=>$bill];
    $id=(string)$bill['id']; $storeId=(string)$store['id'];
    takeaway_print_insert($pdo,$storeId,$id,$id.':receipt','receipt',$base);
    $total=0;
    foreach($bill['items']??[] as $item) {
        $q=(float)($item['quantity']??0);
        if(is_finite($q) && $q>0 && floor($q)===$q && $q<=1000) $total+=(int)$q;
    }
    $number=0;
    foreach($bill['items']??[] as $line=>$item) {
        $q=(float)($item['quantity']??0);
        $error=(!is_finite($q) || $q<=0 || floor($q)!==$q || $q>1000)
            ? 'Số lượng món không phải số nguyên từ 1 đến 1000. Kiểm tra trước khi in tem.' : '';
        $count=$error===''?(int)$q:1;
        for($unit=1;$unit<=$count;$unit++) {
            $doc=$base; unset($doc['bill']['items']);
            $doc['item']=$item; $doc['labelNumber']=$error===''?++$number:0; $doc['labelTotal']=$total;
            $doc['validationError']=$error;
            takeaway_print_insert($pdo,$storeId,$id,"$id:label:$line:$unit",'label',$doc,$error);
        }
    }
    return true;
}

function takeaway_print_list(PDO $pdo,string $storeId,int $offset=0,string $billId=''): array
{
    $offset=max(0,$offset);$params=[$storeId];$where='store_id=?';
    if($billId!==''){$where.=' AND bill_id=?';$params[]=$billId;}
    $q=$pdo->prepare("SELECT * FROM takeaway_print_jobs WHERE $where ORDER BY queue_order DESC,id DESC LIMIT 200 OFFSET $offset");
    $q->execute($params); return array_map('takeaway_print_map',$q->fetchAll(PDO::FETCH_ASSOC));
}

function takeaway_print_claim(PDO $pdo,string $storeId,string $terminal,array $kinds): array
{
    $kinds=array_values(array_intersect(['receipt','label'],$kinds));
    if(!$kinds) throw new DomainException('Chọn loại máy in trước khi nhận lệnh.');
    // Never automatically replay stale claims: the printer may already have received them.
    $pdo->prepare("UPDATE takeaway_print_jobs SET status='uncertain',error=?,updated_at=CURRENT_TIMESTAMP WHERE store_id=? AND status='printing' AND updated_at<?")
        ->execute(['Mất xác nhận in. Kiểm tra giấy trước khi in lại.',$storeId,date('Y-m-d H:i:s',time()-300)]);
    $marks=implode(',',array_fill(0,count($kinds),'?'));
    $q=$pdo->prepare("SELECT id FROM takeaway_print_jobs WHERE store_id=? AND status='pending' AND kind IN ($marks) ORDER BY queue_order,id LIMIT 1");
    for($attempt=0;$attempt<5;$attempt++) {
        $q->execute([$storeId,...$kinds]); $id=$q->fetchColumn(); if($id===false) break;
        $token=bin2hex(random_bytes(32));
        $u=$pdo->prepare("UPDATE takeaway_print_jobs SET status='printing',claim_token=?,terminal_name=?,error='',updated_at=CURRENT_TIMESTAMP WHERE id=? AND store_id=? AND status='pending'");
        $u->execute([$token,$terminal,$id,$storeId]);
        if($u->rowCount()===1) {
            $r=$pdo->prepare('SELECT * FROM takeaway_print_jobs WHERE id=?'); $r->execute([$id]);
            return ['item'=>takeaway_print_map($r->fetch(PDO::FETCH_ASSOC)),'claimToken'=>$token];
        }
    }
    return ['item'=>null];
}

function takeaway_print_finish(PDO $pdo,string $storeId,string $id,string $token,string $status,string $error,bool $allowSuperseded=false): bool
{
    if(!in_array($status,['printed','failed','uncertain'],true)) throw new DomainException('Trạng thái không hợp lệ.');
    $q=$pdo->prepare("UPDATE takeaway_print_jobs SET status=?,error=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND store_id=? AND claim_token=? AND status IN ('printing','uncertain')");
    $q->execute([$status,$error,$id,$storeId,$token]);
    if($q->rowCount()!==1) {
        $r=$pdo->prepare('SELECT status FROM takeaway_print_jobs WHERE id=? AND store_id=? AND claim_token=?'); $r->execute([$id,$storeId,$token]);
        if($r->fetchColumn()!==$status) {
            // An explicit staff retry retires the old claim. Discard its late acknowledgement without changing the new job.
            if($allowSuperseded && $token!=='') {
                $current=$pdo->prepare('SELECT claim_token FROM takeaway_print_jobs WHERE id=? AND store_id=?');$current->execute([$id,$storeId]);
                $row=$current->fetch(PDO::FETCH_ASSOC);
                if($row && !hash_equals((string)($row['claim_token']??''),$token)) return false;
            }
            throw new DomainException('Lệnh in đã thay đổi hoặc không thuộc máy này.');
        }
    }
    return true;
}

function takeaway_print_retry(PDO $pdo,string $storeId,string $id): void
{
    $r=$pdo->prepare('SELECT * FROM takeaway_print_jobs WHERE id=? AND store_id=?'); $r->execute([$id,$storeId]);
    $row=$r->fetch(PDO::FETCH_ASSOC);
    if(!$row || !empty(takeaway_print_map($row)['document']['validationError'])) throw new DomainException('Kiểm tra số lượng món trước khi in tem.');
    $q=$pdo->prepare("UPDATE takeaway_print_jobs SET status='pending',claim_token=NULL,error='',updated_at=CURRENT_TIMESTAMP WHERE id=? AND store_id=? AND status IN ('failed','uncertain')");
    $q->execute([$id,$storeId]); if($q->rowCount()!==1) throw new DomainException('Chỉ thử lại lệnh lỗi hoặc chưa xác nhận.');
}
