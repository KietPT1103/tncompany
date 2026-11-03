<?php
declare(strict_types=1);
require_once __DIR__.'/revenue_cashflow.php';

function profit_source_handover(PDO $pdo,string $store,array $dates): array
{
    $result=array_fill_keys($dates,null);
    if(!profit_source_table_exists($pdo,'cashier_shifts'))return $result;
    $params=['store'=>$store,'start'=>$dates[0].' 00:00:00','end'=>(new DateTimeImmutable(end($dates)))->modify('+1 day')->format('Y-m-d').' 00:00:00'];
    $query=$pdo->prepare('SELECT * FROM cashier_shifts WHERE store_id=:store AND opened_at>=:start AND opened_at<:end');
    $query->execute($params);$shifts=$query->fetchAll(PDO::FETCH_ASSOC);
    $query=$pdo->prepare('SELECT shift_id,total,status,payment_method,created_at FROM bills WHERE store_id=:store AND created_at>=:start AND created_at<:end');
    $query->execute($params);$bills=$query->fetchAll(PDO::FETCH_ASSOC);
    $ids=array_column($shifts,'id');
    $query=$pdo->prepare('SELECT * FROM cash_vouchers WHERE (store_id=? AND happened_at>=? AND happened_at<?)'.($ids?' OR source_shift_id IN ('.implode(',',array_fill(0,count($ids),'?')).')':''));
    $query->execute([$store,$params['start'],$params['end'],...$ids]);$vouchers=$query->fetchAll(PDO::FETCH_ASSOC);
    $cashflow=revenue_cashflow_calculate($shifts,$bills,$vouchers,[],$dates,[$store]);
    foreach($cashflow['days'] as $day){
        $count=count($day['shifts']);
        // Unassigned transactions cannot be treated as confirmed handover.
        $unassigned=false;
        foreach($bills as $bill)if($bill['status']!=='cancelled'&&$bill['payment_method']!=='transfer'&&substr($bill['created_at'],0,10)===$day['date']&&!in_array($bill['shift_id'],$ids,true))$unassigned=true;
        foreach($vouchers as $voucher)if(empty($voucher['cancelled_at'])&&($voucher['include_in_cash_flow']??true)&&substr($voucher['happened_at'],0,10)===$day['date']&&!in_array($voucher['shift_id'],$ids,true))$unassigned=true;
        $result[$day['date']]=['amount'=>$count?(float)$day['grossHandover']:null,'provisional'=>$day['provisional']||$unassigned,'shiftCount'=>$count];
    }
    return $result;
}

function profit_salary_payment_period(string $date): ?array
{
    $day=(int)substr($date,8,2);
    if($day===15)return ['startDate'=>substr($date,0,8).'01','endDate'=>$date,'label'=>'Đợt 1'];
    if($day!==5)return null;
    $end=(new DateTimeImmutable($date))->modify('first day of this month')->modify('-1 day')->format('Y-m-d');
    return ['startDate'=>substr($end,0,8).'16','endDate'=>$end,'label'=>'Đợt 2'];
}
