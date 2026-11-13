<?php
declare(strict_types=1);
require_once __DIR__ . '/shift_management.php';
/** Additive tables deliberately leave historical shift types and IDs untouched. */
function takeaway_shifts_schema(PDO $pdo): void
{
    $engine = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' ENGINE=InnoDB' : '';
    $pdo->exec('CREATE TABLE IF NOT EXISTS takeaway_business_cycles (
        id VARCHAR(64) PRIMARY KEY, store_id VARCHAR(32) NOT NULL,
        business_date VARCHAR(10) NOT NULL, opened_at DATETIME NOT NULL, closed_at DATETIME NULL
    )' . $engine);
    $pdo->exec('CREATE TABLE IF NOT EXISTS takeaway_shift_sessions (
        shift_id VARCHAR(64) PRIMARY KEY, cycle_id VARCHAR(64) NOT NULL, store_id VARCHAR(32) NOT NULL,
        shift_number INTEGER NOT NULL, is_final INTEGER NOT NULL, shift_count INTEGER NOT NULL,
        snapshot_json LONGTEXT NULL
    )' . $engine);
}

function takeaway_shift_info(PDO $pdo, string $shiftId): ?array
{
    try {
        $statement=$pdo->prepare('SELECT s.*,c.business_date,c.opened_at AS cycle_opened_at,c.closed_at AS cycle_closed_at FROM takeaway_shift_sessions s JOIN takeaway_business_cycles c ON c.id=s.cycle_id AND c.store_id=s.store_id WHERE s.shift_id=?');
        $statement->execute([$shiftId]);
        $row=$statement->fetch(PDO::FETCH_ASSOC);
    } catch (PDOException $error) {
        if ($error->getCode()==='42S02' || str_contains($error->getMessage(),'no such table')) return null;
        throw $error;
    }
    if (!$row) return null;
    foreach (['shift_number','is_final','shift_count'] as $field) $row[$field]=(int)$row[$field];
    return $row;
}

function takeaway_shift_row(PDO $pdo,string $storeId,string $shiftId): array
{
    $statement=$pdo->prepare('SELECT * FROM cashier_shifts WHERE store_id=? AND id=?'.shift_lock_suffix($pdo));
    $statement->execute([$storeId,$shiftId]);
    $row=$statement->fetch(PDO::FETCH_ASSOC);
    if (!$row) throw new ShiftManagementError('Không tìm thấy ca trong quầy này.',404);
    $binding=takeaway_shift_info($pdo,$shiftId);
    if ($binding) $row=array_merge($row,['business_cycle_id'=>$binding['cycle_id'],'cycle_closed_at'=>$binding['cycle_closed_at']]);
    return $row;
}

function takeaway_shift_lock_store(PDO $pdo,string $storeId): array
{
    $statement=$pdo->prepare('SELECT * FROM stores WHERE id=?'.shift_lock_suffix($pdo));
    $statement->execute([$storeId]);
    $row=$statement->fetch(PDO::FETCH_ASSOC);
    if (!$row || !$row['is_active'] || $row['deleted_at']!==null) throw new ShiftManagementError('Quầy không còn hoạt động.',409);
    return $row;
}
/** The store row serializes all cycle open/close/configuration operations. */
function takeaway_shift_open(PDO $pdo,string $storeId,string $cashier,string $name,array $input,?string $now=null): array
{
    $now=$now??date('Y-m-d H:i:s');
    if (!isset($input['openingCash']) || !is_numeric($input['openingCash']) || !is_finite((float)$input['openingCash']) || (float)$input['openingCash']<=0 || empty($input['deviceId'])) {
        throw new ShiftManagementError('Thiếu thiết bị hoặc tiền mặt đầu ca.');
    }
    $pdo->beginTransaction();
    try {
        $config=takeaway_shift_lock_store($pdo,$storeId);
        if (empty($config['is_take_away']) || empty($config['takeaway_shift_enabled'])) throw new ShiftManagementError('Cấu hình ca đã thay đổi. Vui lòng tải lại.',409);
        $statement=$pdo->prepare("SELECT * FROM cashier_shifts WHERE store_id=? AND cashier_uid=? AND status='open' ORDER BY opened_at DESC LIMIT 1".shift_lock_suffix($pdo));
        $statement->execute([$storeId,$cashier]);
        if ($old=$statement->fetch(PDO::FETCH_ASSOC)) {
            if (!takeaway_shift_info($pdo,$old['id'])) throw new ShiftManagementError('Hãy kết thúc ca cũ trước khi dùng chia ca mới.',409);
            $pdo->commit();
            return ['item'=>$old,'alreadyOpen'=>true];
        }
        $statement=$pdo->prepare('SELECT shift_number FROM user_takeaway_shifts WHERE user_id=? AND store_id=?');
        $statement->execute([$cashier,$storeId]);
        $shiftNumber=(int)$statement->fetchColumn();
        $shiftCount=(int)$config['takeaway_shift_count'];
        $finalShift=(int)$config['takeaway_final_shift'];
        if ($shiftNumber<1 || $shiftNumber>$shiftCount) throw new ShiftManagementError('Tài khoản chưa được gán ca hợp lệ tại quầy này.');
        $statement=$pdo->prepare('SELECT * FROM takeaway_business_cycles WHERE store_id=? AND closed_at IS NULL'.shift_lock_suffix($pdo));
        $statement->execute([$storeId]);
        $cycle=$statement->fetch(PDO::FETCH_ASSOC);
        if (!$cycle) {
            if ($shiftNumber!==1) throw new ShiftManagementError('Ca 1 phải mở ngày kinh doanh trước.',409);
            $statement=$pdo->prepare("SELECT s.id FROM cashier_shifts s LEFT JOIN takeaway_shift_sessions t ON t.shift_id=s.id WHERE s.store_id=? AND s.status='open' AND t.shift_id IS NULL");
            $statement->execute([$storeId]);
            if ($statement->fetchColumn()) throw new ShiftManagementError('Hãy đóng các ca cũ trước khi bắt đầu vòng mới.',409);
            $cycle=['id'=>bin2hex(random_bytes(16)),'business_date'=>substr($now,0,10)];
            $pdo->prepare('INSERT INTO takeaway_business_cycles(id,store_id,business_date,opened_at) VALUES(?,?,?,?)')->execute([$cycle['id'],$storeId,$cycle['business_date'],$now]);
        }
        $statement=$pdo->prepare('SELECT s.status FROM cashier_shifts s JOIN takeaway_shift_sessions t ON t.shift_id=s.id WHERE t.cycle_id=? AND t.shift_number=?');
        $statement->execute([$cycle['id'],$shiftNumber]);
        $prior=$statement->fetchAll(PDO::FETCH_COLUMN);
        if (in_array('open',$prior,true)) throw new ShiftManagementError('Ca này đã có nhân viên đang làm.',409);
        if ($prior && ($input['confirmReopen']??false)!==true) throw new ShiftManagementError('Ca này đã kết thúc trong vòng đang chạy. Hãy xác nhận mở thêm ca.',409);
        $shiftId=bin2hex(random_bytes(16));
        $pdo->prepare("INSERT INTO cashier_shifts(id,store_id,cashier_uid,cashier_name,shift_type,status,opening_cash,open_note,opened_by_device_id,opened_by_device_name,opened_at) VALUES(?,?,?,?,'single','open',?,?,?,?,?)")->execute([$shiftId,$storeId,$cashier,$name,(float)$input['openingCash'],trim((string)($input['openNote']??'')),substr((string)$input['deviceId'],0,100),substr((string)($input['deviceName']??'POS'),0,255),$now]);
        $pdo->prepare('INSERT INTO takeaway_shift_sessions(shift_id,cycle_id,store_id,shift_number,is_final,shift_count) VALUES(?,?,?,?,?,?)')->execute([$shiftId,$cycle['id'],$storeId,$shiftNumber,(int)($shiftNumber===$finalShift),$shiftCount]);
        $row=takeaway_shift_row($pdo,$storeId,$shiftId);
        $pdo->commit();
        return ['item'=>$row,'alreadyOpen'=>false];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function takeaway_shift_summary(array $row): array
{
    $map=['cashSales'=>'cash_sales','transferSales'=>'transfer_sales','totalSales'=>'total_sales','completedBills'=>'completed_bills','cancelledBills'=>'cancelled_bills','cancelledAmount'=>'cancelled_amount','incomeVouchers'=>'income_vouchers','expenseVouchers'=>'expense_vouchers','netCashFlow'=>'net_cash_flow','expectedClosingCash'=>'expected_closing_cash'];
    $result=[];
    foreach ($map as $key=>$field) $result[$key]=(float)($row[$field]??0);
    if (!isset($row['expected_closing_cash'])) $result['expectedClosingCash']=(float)$row['opening_cash'];
    return $result;
}

function takeaway_shift_owner(array $row,array $user): void
{
    if (($user['role']??'')==='user' && $row['cashier_uid']!==($user['id']??'')) throw new ShiftManagementError('Ca không thuộc tài khoản hiện tại.',403);
}

function takeaway_cycle_totals(PDO $pdo,array $binding): array
{
    $slots=[];
    for ($shiftNumber = 1; $shiftNumber <= $binding['shift_count']; $shiftNumber++) {
        $slots[$shiftNumber] = [
            'number' => $shiftNumber, 'worked' => false,
            'totalSales' => 0.0, 'cashSales' => 0.0, 'transferSales' => 0.0,
            'incomeVouchers' => 0.0, 'expenseVouchers' => 0.0,
            'expectedHandover' => 0.0, 'actualHandover' => 0.0,
        ];
    }
    $statement=$pdo->prepare('SELECT s.*,t.shift_number FROM cashier_shifts s JOIN takeaway_shift_sessions t ON t.shift_id=s.id WHERE t.cycle_id=? AND t.store_id=? ORDER BY s.id'.shift_lock_suffix($pdo));
    $statement->execute([$binding['cycle_id'],$binding['store_id']]);
    foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
        shift_management_recalculate($pdo,$row);
        $current=takeaway_shift_row($pdo,$binding['store_id'],$row['id']);
        $summary=takeaway_shift_summary($current);
        $n=(int)$row['shift_number'];
        $slots[$n]['worked']=true;
        foreach (['totalSales','cashSales','transferSales','incomeVouchers','expenseVouchers'] as $key) $slots[$n][$key]+=$summary[$key];
        $out=cash_transfers_outgoing($pdo,$binding['store_id'],$row['id']);
        $slots[$n]['expectedHandover']+=$summary['cashSales']+$summary['incomeVouchers']-$summary['expenseVouchers']-$out;
        $slots[$n]['actualHandover']+=(float)$current['closing_cash']-(float)$current['opening_cash']-$out;
    }
    $result=['shifts'=>array_values($slots)];
    foreach (['totalSales','cashSales','transferSales','incomeVouchers','expenseVouchers','expectedHandover','actualHandover'] as $key) $result[$key]=array_sum(array_column($slots,$key));
    $result['difference']=$result['actualHandover']-$result['expectedHandover'];
    return $result;
}

function takeaway_shift_close(PDO $pdo,string $storeId,string $shiftId,array $user,array $input,?string $now=null): array
{
    $now=$now??date('Y-m-d H:i:s');
    if (!isset($input['closingCash']) || !is_numeric($input['closingCash']) || !is_finite((float)$input['closingCash']) || (float)$input['closingCash']<0) throw new ShiftManagementError('Tiền mặt cuối ca không hợp lệ.');
    $pdo->beginTransaction();
    try {
        $config=takeaway_shift_lock_store($pdo,$storeId);
        $row=takeaway_shift_row($pdo,$storeId,$shiftId);
        takeaway_shift_owner($row,$user);
        $binding=takeaway_shift_info($pdo,$shiftId);
        if (!$binding || $binding['store_id']!==$storeId) throw new ShiftManagementError('Ca không thuộc vòng kinh doanh này.',404);
        if ($row['status']==='closed' && $binding['snapshot_json']) {
            $report=json_decode($binding['snapshot_json'],true,512,JSON_THROW_ON_ERROR);
            if (abs($report['closingCash']-(float)$input['closingCash'])>0.001 || $report['note']!==trim((string)($input['closeNote']??''))) throw new ShiftManagementError('Ca đã đóng với nội dung khác. Hãy in lại phiếu đã chốt.',409);
            $pdo->commit();
            return ['report'=>$report,'idempotent'=>true];
        }
        shift_validate_active_use($row,$user,true);
        if ($binding['cycle_closed_at']!==null) throw new ShiftManagementError('Ngày kinh doanh đã chốt.',409);
        if ($binding['is_final']) {
            $statement=$pdo->prepare("SELECT s.id FROM cashier_shifts s JOIN takeaway_shift_sessions t ON t.shift_id=s.id WHERE t.cycle_id=? AND s.status='open' AND s.id<>?");
            $statement->execute([$binding['cycle_id'],$shiftId]);
            if ($statement->fetchColumn()) throw new ShiftManagementError('Hãy đóng các ca khác đang mở trước khi chốt ca cuối.',409);
            $statement=$pdo->prepare('SELECT DISTINCT shift_number FROM takeaway_shift_sessions WHERE cycle_id=?');
            $statement->execute([$binding['cycle_id']]);
            $worked=array_map('intval',$statement->fetchAll(PDO::FETCH_COLUMN));
            $missing=array_values(array_diff(range(1,$binding['shift_count']),$worked));
            if ($missing && ($input['confirmMissingShifts']??false)!==true) throw new ShiftManagementError('Chưa phát sinh Ca '.implode(', Ca ',$missing).'. Hãy xác nhận chốt vòng thiếu ca.',409);
        }
        shift_management_recalculate($pdo,$row);
        $row=takeaway_shift_row($pdo,$storeId,$shiftId);
        shift_validate_close_preview($row,is_array($input['summary']??null)?$input['summary']:[],isset($input['expectedOpenedAt'])?(string)$input['expectedOpenedAt']:null);
        $pdo->prepare("UPDATE cashier_shifts SET status='closed',closed_at=?,closing_cash=?,close_note=? WHERE id=? AND store_id=?")->execute([$now,(float)$input['closingCash'],trim((string)($input['closeNote']??'')),$shiftId,$storeId]);
        $report = [
            'version' => 1,
            'storeId' => $storeId,
            'storeName' => $config['name'],
            'businessDate' => $binding['business_date'],
            'cycleId' => $binding['cycle_id'],
            'shiftId' => $shiftId,
            'shiftNumber' => $binding['shift_number'],
            'isFinalShift' => (bool)$binding['is_final'],
            'openedAt' => $row['opened_at'],
            'closedAt' => $now,
            'openingCash' => (float)$row['opening_cash'],
            'closingCash' => (float)$input['closingCash'],
            'cashierName' => $row['cashier_name'],
            'note' => trim((string)($input['closeNote'] ?? '')),
            'summary' => takeaway_shift_summary($row),
            'cycle' => $binding['is_final'] ? takeaway_cycle_totals($pdo,$binding) : null,
        ];
        $pdo->prepare('UPDATE takeaway_shift_sessions SET snapshot_json=? WHERE shift_id=?')->execute([json_encode($report,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$shiftId]);
        if ($binding['is_final']) $pdo->prepare('UPDATE takeaway_business_cycles SET closed_at=? WHERE id=? AND closed_at IS NULL')->execute([$now,$binding['cycle_id']]);
        $pdo->commit();
        return ['report'=>$report,'idempotent'=>false];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function takeaway_shift_report(PDO $pdo,string $storeId,string $shiftId,array $user): array
{
    $row=takeaway_shift_row($pdo,$storeId,$shiftId);
    takeaway_shift_owner($row,$user);
    $binding=takeaway_shift_info($pdo,$shiftId);
    if (!$binding || !$binding['snapshot_json']) throw new ShiftManagementError('Chưa có phiếu kết ca đã chốt.',404);
    return json_decode($binding['snapshot_json'],true,512,JSON_THROW_ON_ERROR);
}
