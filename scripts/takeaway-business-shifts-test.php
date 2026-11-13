<?php
declare(strict_types=1);
date_default_timezone_set('Asia/Ho_Chi_Minh');
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
check(is_file(__DIR__.'/../public/api/_lib/takeaway_shifts.php'), 'Business-cycle implementation must exist');
require __DIR__.'/../public/api/_lib/takeaway_shifts.php';
function reject(callable $fn, int $status): void {
    try { $fn(); } catch (ShiftManagementError $e) { check($e->status === $status, $e->getMessage()); return; }
    throw new RuntimeException('Expected rejection '.$status);
}
$p = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$p->exec("CREATE TABLE stores(id TEXT PRIMARY KEY,name TEXT,is_take_away INTEGER,takeaway_shift_enabled INTEGER,takeaway_shift_count INTEGER,takeaway_final_shift INTEGER,is_active INTEGER,deleted_at TEXT);
INSERT INTO stores VALUES('cart','Xe',1,1,4,4,1,NULL),('other','Other',1,1,1,1,1,NULL);
CREATE TABLE user_takeaway_shifts(user_id TEXT,store_id TEXT,shift_number INTEGER,PRIMARY KEY(user_id,store_id));
INSERT INTO user_takeaway_shifts VALUES('u1','cart',1),('u2','cart',2),('u3','cart',3),('u4','cart',4),('u1','other',1);
CREATE TABLE cashier_shifts(id TEXT PRIMARY KEY,store_id TEXT,cashier_uid TEXT,cashier_name TEXT,shift_type TEXT,status TEXT,opening_cash REAL,open_note TEXT,opened_by_device_id TEXT,opened_by_device_name TEXT,opened_at TEXT,closed_at TEXT,closing_cash REAL,close_note TEXT,cash_sales REAL,transfer_sales REAL,total_sales REAL,completed_bills INTEGER,cancelled_bills INTEGER,cancelled_amount REAL,income_vouchers REAL,expense_vouchers REAL,net_cash_flow REAL,expected_closing_cash REAL);
CREATE TABLE bills(id TEXT PRIMARY KEY,store_id TEXT,shift_id TEXT,total REAL,status TEXT,payment_method TEXT,created_at TEXT);
CREATE TABLE cash_vouchers(id TEXT PRIMARY KEY,store_id TEXT,shift_id TEXT,amount REAL,voucher_type TEXT,include_in_cash_flow INTEGER,cancelled_at TEXT,happened_at TEXT,source_shift_id TEXT);");
takeaway_shifts_schema($p);
$input=['openingCash'=>100,'deviceId'=>'d1','deviceName'=>'Laptop'];
reject(fn()=>takeaway_shift_open($p,'cart','u2','Two',$input,'2026-11-13 00:10:00'),409);
reject(fn()=>takeaway_shift_open($p,'cart','unassigned','None',$input,'2026-11-12 23:00:00'),422);
$first=takeaway_shift_open($p,'cart','u1','One',$input,'2026-11-12 23:00:00');
$id1=$first['item']['id'];
$info1=takeaway_shift_info($p,$id1);
check($info1['shift_number']===1 && $info1['business_date']==='2026-11-12', 'Assigned first slot creates a business day');
check(takeaway_shift_open($p,'cart','u1','One',$input,'2026-11-13 00:01:00')['alreadyOpen'], 'Opening replay returns the same session');
$p->exec("INSERT INTO bills VALUES('before','cart','$id1',200,'completed','cash','2026-11-12 23:30:00'),('after','cart','$id1',300,'completed','transfer','2026-11-13 00:30:00'),('void','cart','$id1',999,'cancelled','cash','2026-11-13 00:40:00')");
shift_validate_active_use(takeaway_shift_row($p,'cart',$id1),['role'=>'user','id'=>'u1'],false,'2026-11-13');
function closing(PDO $p,string $id,float $cash=300,array $extra=[]): array {
    $row=takeaway_shift_row($p,'cart',$id);shift_management_recalculate($p,$row);
    return array_merge(['closingCash'=>$cash,'closeNote'=>'','summary'=>takeaway_shift_summary(takeaway_shift_row($p,'cart',$id))],$extra);
}
$body=closing($p,$id1);
reject(fn()=>takeaway_shift_close($p,'cart',$id1,['role'=>'user','id'=>'u2'],$body,'2026-11-13 00:50:00'),403);
$closed1=takeaway_shift_close($p,'cart',$id1,['role'=>'user','id'=>'u1'],$body,'2026-11-13 00:50:00');
check($closed1['report']['summary']['totalSales']===500.0, 'Single shift includes sales on both sides of midnight');
check(takeaway_shift_close($p,'cart',$id1,['role'=>'user','id'=>'u1'],$body,'2026-11-13 00:51:00')['idempotent'], 'Close replay returns persisted report');
$second=takeaway_shift_open($p,'cart','u2','Two',$input,'2026-11-13 01:00:00');$id2=$second['item']['id'];
check(takeaway_shift_info($p,$id2)['cycle_id']===$info1['cycle_id'], 'Next slot after midnight belongs to previous business cycle');
check(cash_transfers_same_business_day($p,takeaway_shift_row($p,'cart',$id1),takeaway_shift_row($p,'cart',$id2)), 'Transfer may cross midnight inside one cycle');
$final=takeaway_shift_open($p,'cart','u4','Four',$input,'2026-11-13 01:05:00');$id4=$final['item']['id'];
reject(fn()=>takeaway_shift_close($p,'cart',$id4,['role'=>'user','id'=>'u4'],closing($p,$id4,100,['confirmMissingShifts'=>true]),'2026-11-13 01:10:00'),409);
takeaway_shift_close($p,'cart',$id2,['role'=>'user','id'=>'u2'],closing($p,$id2,100),'2026-11-13 01:15:00');
reject(fn()=>takeaway_shift_close($p,'cart',$id4,['role'=>'user','id'=>'u4'],closing($p,$id4,100),'2026-11-13 01:20:00'),409);
$last=takeaway_shift_close($p,'cart',$id4,['role'=>'user','id'=>'u4'],closing($p,$id4,100,['confirmMissingShifts'=>true]),'2026-11-13 01:20:00');
check($last['report']['cycle']['totalSales']===500.0 && count($last['report']['cycle']['shifts'])===4, 'Final report includes all configured slots, including unworked slot');
check($last['report']['businessDate']==='2026-11-12', 'Final report retains first-slot business date');
$p->exec("UPDATE bills SET total=9999 WHERE id='before'");
check((float)takeaway_shift_report($p,'cart',$id4,['role'=>'user','id'=>'u4'])['cycle']['totalSales']===500.0, 'Reprint preserves closing snapshot despite later corrections');
reject(fn()=>takeaway_shift_report($p,'other',$id4,['role'=>'admin','id'=>'a']),404);
reject(fn()=>takeaway_shift_open($p,'cart','u2','Two',$input,'2026-11-13 02:00:00'),409);
$next=takeaway_shift_open($p,'cart','u1','One',$input,'2026-11-13 02:00:00');
check(takeaway_shift_info($p,$next['item']['id'])['cycle_id']!==$info1['cycle_id'], 'First slot after final close creates a distinct cycle');
check(!cash_transfers_same_business_day($p,takeaway_shift_row($p,'cart',$id2),takeaway_shift_row($p,'cart',$next['item']['id'])), 'Same calendar day does not permit transfers between cycles');
$one=takeaway_shift_open($p,'other','u1','One',$input,'2026-11-13 03:00:00');
$oneBody=['closingCash'=>100,'summary'=>takeaway_shift_summary($one['item'])];
check(takeaway_shift_close($p,'other',$one['item']['id'],['role'=>'user','id'=>'u1'],$oneBody,'2026-11-13 04:00:00')['report']['isFinalShift'], 'One-slot store closes its cycle');
echo "PASS takeaway cycles: overnight totals, assigned slots, final close, ownership, replay, missing/open slots and immutable reprint\n";
