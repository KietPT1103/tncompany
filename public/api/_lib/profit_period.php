<?php
declare(strict_types=1);
require_once __DIR__ . '/profit_sources.php';

function profit_period_dates(string $start, string $end): array
{
    daily_profit_date($start); daily_profit_date($end);
    $from = new DateTimeImmutable($start); $to = new DateTimeImmutable($end);
    if ($start > $end || $from->diff($to)->days > 365) throw new InvalidArgumentException('Chọn khoảng ngày hợp lệ, tối đa 366 ngày.');
    $dates = [];
    for ($day = $from; $day <= $to; $day = $day->modify('+1 day')) $dates[] = $day->format('Y-m-d');
    return $dates;
}
function profit_period_sources(PDO $pdo, string $storeId, string $start, string $end): array
{
    $days = [];
    foreach (profit_period_dates($start, $end) as $date) $days[$date] = ['revenue'=>0.0,'billCount'=>0,'sales'=>[],'vouchers'=>[]];
    foreach (profit_source_salary($pdo, $storeId, array_keys($days)) as $date=>$estimate) $days[$date]['salaryEstimate'] = $estimate;
    $costs = profit_source_costs($pdo, $storeId);
    $params = ['store'=>$storeId,'start'=>$start.' 00:00:00','end'=>(new DateTimeImmutable($end))->modify('+1 day')->format('Y-m-d').' 00:00:00'];
    $filter = "b.store_id=:store AND b.status='completed' AND b.created_at>=:start AND b.created_at<:end";
    $stmt = $pdo->prepare("SELECT DATE(b.created_at) AS day, SUM(b.total) AS revenue, COUNT(*) AS bill_count FROM bills b WHERE $filter GROUP BY DATE(b.created_at)");
    $stmt->execute($params);
    foreach ($stmt->fetchAll() as $row) {
        $days[$row['day']]['revenue'] = daily_profit_money((float)$row['revenue'], 'doanh thu');
        $days[$row['day']]['billCount'] = (int)$row['bill_count'];
    }
    $stmt = $pdo->prepare("SELECT DATE(b.created_at) AS day, i.menu_id, i.name, SUM(i.quantity) AS quantity
        FROM bill_items i JOIN bills b ON b.id=i.bill_id
        WHERE $filter GROUP BY DATE(b.created_at), i.menu_id, i.name ORDER BY i.name");
    $stmt->execute($params);
    foreach ($stmt->fetchAll() as $row) {
        $code = (string)$row['menu_id']; $key = $code !== '' ? $code : 'name:'.$row['name'];
        $cost = $costs[$code]['unitCost'] ?? null;
        $quantity = (float)$row['quantity']; daily_profit_money($quantity, 'số lượng bán');
        if (!isset($days[$row['day']]['sales'][$key])) $days[$row['day']]['sales'][$key] = ['key'=>$key,'code'=>$code,'name'=>(string)$row['name'],'quantity'=>0,'unitCost'=>$cost,'costSource'=>$costs[$code]['costSource'] ?? null];
        $days[$row['day']]['sales'][$key]['quantity'] += $quantity;
    }
    $stmt = $pdo->prepare("SELECT DATE(happened_at) AS day, id, code, category, amount, note FROM cash_vouchers
        WHERE store_id=:store AND voucher_type='expense' AND cancelled_at IS NULL AND include_in_cash_flow=1
        AND happened_at>=:start AND happened_at<:end ORDER BY happened_at,id");
    $stmt->execute($params);
    foreach ($stmt->fetchAll() as $row) $days[$row['day']]['vouchers'][] = ['id'=>(string)$row['id'],'code'=>(string)$row['code'],'category'=>(string)$row['category'],'amount'=>daily_profit_money((float)$row['amount'], 'phiếu chi'),'note'=>(string)($row['note'] ?? '')];
    foreach ($days as &$day) $day['sales'] = array_values($day['sales']);
    return $days;
}
function profit_period_load(PDO $pdo, string $storeId, string $start, string $end): array
{
    $sources = profit_period_sources($pdo, $storeId, $start, $end);
    $stmt = $pdo->prepare('SELECT report_date,inputs_json,updated_at FROM daily_profit_inputs WHERE store_id=:store AND report_date>=:start AND report_date<=:end');
    $stmt->execute(['store'=>$storeId,'start'=>$start,'end'=>$end]);
    $saved = [];
    foreach ($stmt->fetchAll() as $row) $saved[$row['report_date']] = daily_profit_saved_row($row);
    $days = [];
    foreach ($sources as $date=>$source) $days[] = ['date'=>$date,'source'=>$source,'saved'=>$saved[$date] ?? null];
    return $days;
}
function profit_history_ensure_schema(PDO $pdo): void
{
    $index = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite' ? '' : ', KEY idx_profit_history_store_saved (store_id,saved_at,id)';
    $pdo->exec('CREATE TABLE IF NOT EXISTS profit_report_history (
        id VARCHAR(64) NOT NULL PRIMARY KEY, store_id VARCHAR(32) NOT NULL,
        start_date VARCHAR(10) NOT NULL, end_date VARCHAR(10) NOT NULL,
        snapshot_json MEDIUMTEXT NOT NULL, saved_by VARCHAR(64) NOT NULL, saved_at VARCHAR(32) NOT NULL
    '.$index.')');
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') $pdo->exec('CREATE INDEX IF NOT EXISTS idx_profit_history_store_saved ON profit_report_history (store_id,saved_at,id)');
}
function profit_period_snapshot(array $sources, array $rawInputs): array
{
    if (count($sources) !== count($rawInputs)) throw new InvalidArgumentException('Cần nhập đủ chi phí cho tất cả ngày trong kỳ.');
    $totals = ['revenue'=>0,'materialCost'=>0,'salary'=>0,'electricity'=>0,'water'=>0,'other'=>0,'marketing'=>0,'thienExpense'=>0,'ingredientInventory'=>0,'debt'=>0,'voucherCost'=>0,'totalCosts'=>0,'profit'=>0];
    $days = [];
    foreach ($sources as $date=>$source) {
        if (!is_array($rawInputs[$date] ?? null)) throw new InvalidArgumentException('Thiếu chi phí ngày '.$date.'.');
        try {
            if (!isset($source['salaryEstimate']['amount'])) throw new InvalidArgumentException('Chưa có ước lượng lương đã lưu cho ngày này.');
            $rawInputs[$date]['salary'] = $source['salaryEstimate']['amount'];
            $inputs = daily_profit_validate_inputs($rawInputs[$date]);
            daily_profit_require_complete($source, $inputs);
        } catch (InvalidArgumentException $e) { throw new InvalidArgumentException($date.': '.$e->getMessage()); }
        $cost = 0;
        foreach ($source['sales'] as $sale) $cost += $sale['quantity'] * ($inputs['costOverrides'][$sale['key']] ?? $sale['unitCost']);
        $cashier = array_sum(array_column($source['vouchers'], 'amount'));
        $total = $cost + $cashier + $inputs['salary'] + $inputs['electricity'] + $inputs['water'] + $inputs['other'] + $inputs['marketing'] + $inputs['thienExpense'];
        $result = ['revenue'=>$source['revenue'],'materialCost'=>$cost,'salary'=>$inputs['salary'],'electricity'=>$inputs['electricity'],'water'=>$inputs['water'],'other'=>$inputs['other'],'marketing'=>$inputs['marketing'],'thienExpense'=>$inputs['thienExpense'],'ingredientInventory'=>$inputs['ingredientInventory'],'debt'=>$inputs['debt'],'voucherCost'=>$cashier,'totalCosts'=>$total,'profit'=>$source['revenue']-$total+$inputs['ingredientInventory']-$inputs['debt']];
        foreach ($totals as $key=>$_) $totals[$key] += $result[$key];
        $days[] = ['date'=>$date,'inputs'=>$inputs,'result'=>$result];
    }
    $totals['margin'] = $totals['revenue'] > 0 ? $totals['profit']/$totals['revenue']*100 : null;
    return ['totals'=>$totals,'days'=>$days];
}
function profit_period_save(PDO $pdo, string $storeId, string $start, string $end, array $rawInputs, string $userId): array
{
    $pdo->beginTransaction();
    try {
        $snapshot = profit_period_snapshot(profit_period_sources($pdo, $storeId, $start, $end), $rawInputs);
        foreach ($snapshot['days'] as $day) daily_profit_save($pdo, $storeId, $day['date'], $day['inputs'], $userId);
        $id = bin2hex(random_bytes(16)); $now = date('c');
        $pdo->prepare('INSERT INTO profit_report_history (id,store_id,start_date,end_date,snapshot_json,saved_by,saved_at) VALUES (:id,:store,:start,:end,:snapshot,:user,:now)')->execute([
            'id'=>$id,'store'=>$storeId,'start'=>$start,'end'=>$end,'snapshot'=>json_encode($snapshot, JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'user'=>$userId,'now'=>$now]);
        $pdo->commit();
        return ['id'=>$id,'startDate'=>$start,'endDate'=>$end,'savedAt'=>$now,'totals'=>$snapshot['totals']];
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
}
function profit_history(PDO $pdo, string $storeId, int $page, ?string $id = null): array
{
    if ($id !== null) {
        $stmt = $pdo->prepare('SELECT * FROM profit_report_history WHERE store_id=:store AND id=:id');
        $stmt->execute(['store'=>$storeId,'id'=>$id]);
        $row = $stmt->fetch();
        if (!$row) throw new InvalidArgumentException('Không tìm thấy báo cáo đã lưu.');
        return ['id'=>$row['id'],'startDate'=>$row['start_date'],'endDate'=>$row['end_date'],'savedAt'=>$row['saved_at'],'snapshot'=>json_decode($row['snapshot_json'], true, 512, JSON_THROW_ON_ERROR)];
    }
    $count = $pdo->prepare('SELECT COUNT(*) FROM profit_report_history WHERE store_id=:store'); $count->execute(['store'=>$storeId]);
    $offset = ($page-1)*20;
    $stmt = $pdo->prepare('SELECT * FROM profit_report_history WHERE store_id=:store ORDER BY saved_at DESC,id DESC LIMIT 20 OFFSET '.$offset);
    $stmt->execute(['store'=>$storeId]);
    $rows = array_map(static function(array $row): array { $snapshot=json_decode($row['snapshot_json'], true, 512, JSON_THROW_ON_ERROR); return ['id'=>$row['id'],'startDate'=>$row['start_date'],'endDate'=>$row['end_date'],'savedAt'=>$row['saved_at'],'totals'=>$snapshot['totals']]; }, $stmt->fetchAll());
    return ['rows'=>$rows,'total'=>(int)$count->fetchColumn(),'page'=>$page];
}
