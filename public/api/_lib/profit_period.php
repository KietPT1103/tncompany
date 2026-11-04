<?php
declare(strict_types=1);
require_once __DIR__ . '/profit_sources.php';
require_once __DIR__ . '/profit_handover.php';

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
    foreach (profit_source_handover($pdo,$storeId,array_keys($days)) as $date=>$handover) $days[$date]['handover']=$handover;
    $costs = profit_source_costs($pdo, $storeId);
    $params = ['store'=>$storeId,'start'=>$start.' 00:00:00','end'=>(new DateTimeImmutable($end))->modify('+1 day')->format('Y-m-d').' 00:00:00'];
    $filter = "b.store_id=:store AND b.status='completed' AND b.created_at>=:start AND b.created_at<:end";
    $stmt = $pdo->prepare("SELECT DATE(b.created_at) AS day, SUM(b.total) AS revenue, COUNT(*) AS bill_count FROM bills b WHERE $filter GROUP BY DATE(b.created_at)");
    $stmt->execute($params);
    foreach ($stmt->fetchAll() as $row) {
        $days[$row['day']]['revenue'] = daily_profit_money((float)$row['revenue'], 'doanh thu');
        $days[$row['day']]['billCount'] = (int)$row['bill_count'];
    }
    $stmt = $pdo->prepare("SELECT DATE(b.created_at) AS day, b.id AS bill_id, b.total AS bill_total, i.menu_id, i.name,
        SUM(i.quantity) AS quantity, SUM(i.line_total) AS item_total,
        SUM(CASE WHEN i.line_total IS NULL OR i.line_total<0 THEN 1 ELSE 0 END) AS invalid_prices
        FROM bill_items i JOIN bills b ON b.id=i.bill_id
        WHERE $filter GROUP BY DATE(b.created_at), b.id, b.total, i.menu_id, i.name ORDER BY i.name");
    $stmt->execute($params);
    $saleRows = $stmt->fetchAll();
    $billAmounts = [];
    foreach ($saleRows as $row) {
        $id = $row['bill_id'];
        $billAmounts[$id]['subtotal'] = ($billAmounts[$id]['subtotal'] ?? 0) + (float)$row['item_total'];
        $billAmounts[$id]['invalid'] = ($billAmounts[$id]['invalid'] ?? false) || (int)$row['invalid_prices'] > 0;
        $billAmounts[$id]['remainingItems'] = ($billAmounts[$id]['remainingItems'] ?? 0) + ((float)$row['item_total'] > 0 ? 1 : 0);
        $billAmounts[$id]['allocatedCents'] = 0;
    }
    foreach ($saleRows as $row) {
        $code = (string)$row['menu_id']; $key = $code !== '' ? $code : 'name:'.$row['name'];
        $cost = $costs[$code]['unitCost'] ?? null;
        $quantity = (float)$row['quantity']; daily_profit_money($quantity, 'số lượng bán');
        if (!isset($days[$row['day']]['sales'][$key])) $days[$row['day']]['sales'][$key] = ['key'=>$key,'code'=>$code,'name'=>(string)$row['name'],'quantity'=>0,'netSales'=>0.0,'unitCost'=>$cost,'costSource'=>$costs[$code]['costSource'] ?? null];
        $days[$row['day']]['sales'][$key]['quantity'] += $quantity;
        // Allocate the amount actually charged on each completed bill proportionally
        // to its item totals; this includes bill discounts without applying them twice.
        $bill = &$billAmounts[$row['bill_id']];
        $net = null;
        if (!$bill['invalid'] && $bill['subtotal'] > 0) {
            $cents = 0;
            if ((float)$row['item_total'] > 0) {
                $totalCents = (int)round((float)$row['bill_total'] * 100);
                $remaining = max(0,$totalCents-$bill['allocatedCents']);
                $cents = --$bill['remainingItems'] === 0 ? $remaining : min($remaining,(int)round((float)$row['item_total']/$bill['subtotal']*$totalCents));
                $bill['allocatedCents'] += $cents;
            }
            $net = $cents / 100;
        } elseif (!$bill['invalid'] && (float)$row['bill_total'] === 0.0) $net = 0.0;
        unset($bill);
        $previous = $days[$row['day']]['sales'][$key]['netSales'];
        $days[$row['day']]['sales'][$key]['netSales'] = $previous !== null && $net !== null ? round($previous + $net,2) : null;
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
    $totals = ['revenue'=>0,'materialCost'=>0,'salary'=>0,'electricity'=>0,'water'=>0,'other'=>0,'marketing'=>0,'thienExpense'=>0,'ingredientInventory'=>0,'debt'=>0,'voucherCost'=>0,'tax'=>0,'totalCosts'=>0,'profit'=>0];
    $totals += array_fill_keys(['grossProfit','netProfit','operatingExpense'],0);
    $days = [];
    foreach ($sources as $date=>$source) {
        if (!is_array($rawInputs[$date] ?? null)) throw new InvalidArgumentException('Thiếu chi phí ngày '.$date.'.');
        try {
            if (!isset($source['salaryEstimate']['amount'])) throw new InvalidArgumentException('Chưa có ước lượng lương đã lưu cho ngày này.');
            $rawInputs[$date]['salary'] = $source['salaryEstimate']['amount'];
            $inputs = daily_profit_validate_inputs($rawInputs[$date]);
            daily_profit_require_complete($source, $inputs);
        } catch (InvalidArgumentException $e) { throw new InvalidArgumentException($date.': '.$e->getMessage()); }
        $cost = 0; $gross = 0; $legacySales = true; $grossComplete = true;
        foreach ($source['sales'] as $sale) {
            $lineCost = $sale['quantity'] * ($inputs['costOverrides'][$sale['key']] ?? $sale['unitCost']);
            $cost += $lineCost;
            if (array_key_exists('netSales',$sale)) {
                $legacySales = false;
                if ($sale['netSales'] === null) $grossComplete = false;
                else $gross += $sale['netSales'] - $lineCost;
            } else $grossComplete = false;
        }
        $cashier = array_sum(array_column($source['vouchers'], 'amount'));
        $tax = round($source['revenue'] * 0.045, 2);
        $operating=$inputs['electricity']+$inputs['water']+$inputs['other']+$inputs['marketing']+$inputs['thienExpense']+$inputs['operatingExpense'];
        $total = $cost + $inputs['salary'] + $operating + $tax;
        $result = ['revenue'=>$source['revenue'],'materialCost'=>$cost,'salary'=>$inputs['salary'],'electricity'=>$inputs['electricity'],'water'=>$inputs['water'],'other'=>$inputs['other'],'marketing'=>$inputs['marketing'],'thienExpense'=>$inputs['thienExpense'],'ingredientInventory'=>$inputs['ingredientInventory'],'debt'=>$inputs['debt'],'voucherCost'=>$cashier,'totalCosts'=>$total,'profit'=>$source['revenue']-$total];
        $result['tax'] = $tax;
        $result['grossProfit']=$legacySales ? $source['revenue']-$cost : ($grossComplete ? $gross : null);
        $result['netProfit']=$result['profit'];
        $result['operatingExpense']=$inputs['operatingExpense'];
        $result['cashReceived']=$source['handover']['amount']??null;
        $result['cashFlow']=$result['cashReceived']!==null && empty($source['handover']['provisional']) ? $result['cashReceived']-$inputs['other']-$inputs['operatingExpense']-$inputs['salary']-$tax:null;
        foreach ($totals as $key=>$_) $totals[$key] += $result[$key];
        $days[] = ['date'=>$date,'inputs'=>$inputs,'result'=>$result];
    }
    $totals['margin'] = $totals['revenue'] > 0 ? $totals['profit']/$totals['revenue']*100 : null;
    foreach(['cashReceived','cashFlow'] as $key)$totals[$key]=count(array_filter($days,fn($day)=>$day['result'][$key]===null)) ? null : array_sum(array_map(fn($day)=>$day['result'][$key],$days));
    if (count(array_filter($days,fn($day)=>$day['result']['grossProfit']===null))) $totals['grossProfit']=null;
    return ['totals'=>$totals,'days'=>$days];
}
function profit_period_save(PDO $pdo, string $storeId, string $start, string $end, array $rawInputs, string $userId, ?string $reportId = null): array
{
    $pdo->beginTransaction();
    try {
        if ($reportId !== null) {
            if ($reportId === '' || strlen($reportId) > 64) throw new InvalidArgumentException('Mã báo cáo không hợp lệ.');
            $lock = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
            $find = $pdo->prepare('SELECT start_date,end_date FROM profit_report_history WHERE id=:id AND store_id=:store'.$lock);
            $find->execute(['id'=>$reportId,'store'=>$storeId]);
            $existing = $find->fetch(PDO::FETCH_ASSOC);
            if (!$existing) throw new InvalidArgumentException('Báo cáo không còn tồn tại tại cửa hàng này.');
            if ($existing['start_date'] !== $start || $existing['end_date'] !== $end) throw new InvalidArgumentException('Khoảng ngày không khớp với báo cáo đang chỉnh sửa.');
        }
        $snapshot = profit_period_snapshot(profit_period_sources($pdo, $storeId, $start, $end), $rawInputs);
        foreach ($snapshot['days'] as $day) daily_profit_save($pdo, $storeId, $day['date'], $day['inputs'], $userId);
        $id = $reportId ?? bin2hex(random_bytes(16)); $now = date('c');
        $sql = $reportId === null
            ? 'INSERT INTO profit_report_history (id,store_id,start_date,end_date,snapshot_json,saved_by,saved_at) VALUES (:id,:store,:start,:end,:snapshot,:user,:now)'
            : 'UPDATE profit_report_history SET start_date=:start,end_date=:end,snapshot_json=:snapshot,saved_by=:user,saved_at=:now WHERE id=:id AND store_id=:store';
        $pdo->prepare($sql)->execute([
            'id'=>$id,'store'=>$storeId,'start'=>$start,'end'=>$end,'snapshot'=>json_encode($snapshot, JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'user'=>$userId,'now'=>$now]);
        $pdo->commit();
        return ['id'=>$id,'startDate'=>$start,'endDate'=>$end,'savedAt'=>$now,'totals'=>$snapshot['totals']];
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
}
function profit_history_delete(PDO $pdo, string $storeId, string $id): bool
{
    if ($id === '' || strlen($id) > 64) throw new InvalidArgumentException('Mã báo cáo không hợp lệ.');
    $query = $pdo->prepare('DELETE FROM profit_report_history WHERE store_id=:store AND id=:id');
    $query->execute(['store'=>$storeId,'id'=>$id]);
    return $query->rowCount() > 0;
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
