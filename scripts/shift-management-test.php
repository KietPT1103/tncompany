<?php
declare(strict_types=1);
date_default_timezone_set('Asia/Ho_Chi_Minh');
$library=__DIR__.'/../public/api/_lib/shift_management.php';
if (!is_file($library)) throw new RuntimeException('Missing shift management implementation');
require $library;
function check(bool $condition,string $message):void { if(!$condition) throw new RuntimeException($message); }
function rejects(callable $run,int $status):void {
 try { $run(); } catch(ShiftManagementError $e) { check($e->status===$status,$e->getMessage()); return; }
 throw new RuntimeException('Expected rejection '.$status);
}
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec("CREATE TABLE cashier_shifts (id TEXT PRIMARY KEY,store_id TEXT,cashier_uid TEXT,cashier_name TEXT,shift_type TEXT,status TEXT,opened_at TEXT,closed_at TEXT,opening_cash REAL,closing_cash REAL,cash_sales REAL,transfer_sales REAL,total_sales REAL,completed_bills INTEGER,cancelled_bills INTEGER,cancelled_amount REAL,income_vouchers REAL,expense_vouchers REAL,net_cash_flow REAL,expected_closing_cash REAL)");
$pdo->exec("CREATE TABLE bills (id TEXT PRIMARY KEY,store_id TEXT,shift_id TEXT,cashier_id TEXT,table_number TEXT,total REAL,status TEXT,payment_method TEXT,created_at TEXT)");
$pdo->exec("CREATE TABLE cash_vouchers (id TEXT PRIMARY KEY,store_id TEXT,shift_id TEXT,amount REAL,voucher_type TEXT,include_in_cash_flow INTEGER,cancelled_at TEXT,happened_at TEXT)");
$pdo->exec("CREATE TABLE cashier_shift_corrections (id INTEGER PRIMARY KEY AUTOINCREMENT,store_id TEXT,shift_id TEXT,actor_id TEXT,actor_name TEXT,reason TEXT,before_json TEXT,after_json TEXT,transfers_json TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
$pdo->exec("INSERT INTO cashier_shifts (id,store_id,cashier_uid,cashier_name,shift_type,status,opened_at,closed_at,opening_cash,closing_cash) VALUES ('wrong','cafe','cashier2','Cashier2','shift_2','closed','2026-10-21 17:43:26','2026-10-22 16:48:21',100,500),('correct','cafe','cashier3','Cashier3','shift_3','closed','2026-10-21 17:04:00','2026-10-21 23:00:00',100,300),('other','restaurant','cashier4','Other','shift_3','closed','2026-10-21 17:00:00','2026-10-21 23:00:00',0,0)");
$pdo->exec("INSERT INTO bills VALUES ('yesterday','cafe','wrong','original','T01',200,'completed','cash','2026-10-21 20:00:00'),('today','cafe','wrong','original','T02',300,'completed','transfer','2026-10-22 14:00:00'),('cancelled','cafe','wrong','original','T03',50,'cancelled','cash','2026-10-22 14:10:00')");
$pdo->exec("INSERT INTO cash_vouchers VALUES ('income','cafe','wrong',20,'income',1,NULL,'2026-10-22 14:00:00'),('excluded','cafe','wrong',999,'expense',0,NULL,'2026-10-22 14:00:00'),('void','cafe','wrong',999,'expense',1,'2026-10-22 14:01:00','2026-10-22 14:00:00')");
$admin=['id'=>'admin1','role'=>'admin','display_name'=>'Admin'];
$review=shift_management_review($pdo,'cafe','wrong');
$input=['id'=>'wrong','openedAt'=>'2026-10-22 12:55:00','closedAt'=>'2026-10-22 16:48:21','reason'=>'Correct accidental shift','reviewed'=>true,'reviewToken'=>$review['reviewToken'],'transfers'=>[['billId'=>'yesterday','targetShiftId'=>'correct']]];
rejects(fn()=>shift_management_correct($pdo,'cafe',['id'=>'user','role'=>'user'],$input),403);
rejects(fn()=>shift_management_correct($pdo,'restaurant',$admin,$input),404);
rejects(fn()=>shift_management_correct($pdo,'cafe',$admin,array_replace($input,['reason'=>' '])),422);
rejects(fn()=>shift_management_correct($pdo,'cafe',$admin,array_replace($input,['openedAt'=>'2026-02-30 12:55:00'])),422);
rejects(fn()=>shift_management_correct($pdo,'cafe',$admin,array_replace($input,['closedAt'=>'2026-10-22 10:00:00'])),422);
rejects(fn()=>shift_management_correct($pdo,'cafe',$admin,array_replace($input,['reviewed'=>false])),422);
rejects(fn()=>shift_management_correct($pdo,'cafe',$admin,array_replace($input,['transfers'=>[['billId'=>'yesterday','targetShiftId'=>'other']]])),422);
rejects(fn()=>shift_management_correct($pdo,'cafe',$admin,array_replace($input,['transfers'=>[['billId'=>'today','targetShiftId'=>'correct']]])),422);
rejects(fn()=>shift_management_correct($pdo,'cafe',$admin,array_replace($input,['reviewToken'=>'stale'])),409);
$pdo->exec("UPDATE bills SET total=301 WHERE id='today'");
rejects(fn()=>shift_management_correct($pdo,'cafe',$admin,$input),409);
$pdo->exec("UPDATE bills SET total=300 WHERE id='today'");
$pdo->exec("CREATE TRIGGER fail_audit BEFORE INSERT ON cashier_shift_corrections BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
try { shift_management_correct($pdo,'cafe',$admin,$input); throw new RuntimeException('Audit failure accepted'); } catch(PDOException $e) {}
check($pdo->query("SELECT shift_id FROM bills WHERE id='yesterday'")->fetchColumn()==='wrong','Transfer rollback failed');
check($pdo->query("SELECT opened_at FROM cashier_shifts WHERE id='wrong'")->fetchColumn()==='2026-10-21 17:43:26','Time rollback failed');
$pdo->exec('DROP TRIGGER fail_audit');
shift_management_correct($pdo,'cafe',$admin,$input);
$source=$pdo->query("SELECT * FROM cashier_shifts WHERE id='wrong'")->fetch();
$target=$pdo->query("SELECT * FROM cashier_shifts WHERE id='correct'")->fetch();
check($source['opened_at']==='2026-10-22 12:55:00' && $source['closed_at']==='2026-10-22 16:48:21','Wrong times');
check((float)$source['total_sales']===300.0 && (float)$source['expected_closing_cash']===120.0,'Source summary wrong');
check((float)$source['cancelled_amount']===50.0 && (int)$source['cancelled_bills']===1,'Cancelled bills lost');
check((float)$target['cash_sales']===200.0 && (float)$target['expected_closing_cash']===300.0,'Target summary wrong');
check((float)$source['closing_cash']===500.0,'Actual handover changed');
check($pdo->query("SELECT cashier_id FROM bills WHERE id='yesterday'")->fetchColumn()==='original','Creator changed');
$audit=$pdo->query('SELECT * FROM cashier_shift_corrections')->fetch();
check($audit['actor_id']==='admin1' && $audit['reason']===$input['reason'],'Missing audit');
check(json_decode($audit['transfers_json'],true)[0]['billId']==='yesterday','Missing transfer audit');
check(shift_is_previous_day('2026-10-21 23:59:59','2026-10-22') && !shift_is_previous_day('2026-10-22 00:00:00','2026-10-22'),'Day boundary wrong');
rejects(fn()=>shift_validate_active_use(['status'=>'open','cashier_uid'=>'cashier2','opened_at'=>'2026-10-21 17:43:26'],['id'=>'cashier2','role'=>'user'],false,'2026-10-22'),409);
shift_validate_active_use(['status'=>'open','cashier_uid'=>'cashier2','opened_at'=>'2026-10-21 17:43:26'],['id'=>'cashier2','role'=>'user'],true,'2026-10-22');
rejects(fn()=>shift_validate_active_use(['status'=>'closed','cashier_uid'=>'cashier2','opened_at'=>'2026-10-22 12:55:00'],['id'=>'cashier2','role'=>'user'],true,'2026-10-22'),409);
rejects(fn()=>shift_validate_active_use(['status'=>'open','cashier_uid'=>'cashier2','opened_at'=>'2026-10-22 12:55:00'],['id'=>'other','role'=>'user'],true,'2026-10-22'),403);
shift_validate_close_preview($source,['cashSales'=>0,'transferSales'=>300,'totalSales'=>300,'completedBills'=>1,'cancelledBills'=>1,'cancelledAmount'=>50,'incomeVouchers'=>20,'expenseVouchers'=>0,'netCashFlow'=>320,'expectedClosingCash'=>120],$source['opened_at']);
rejects(fn()=>shift_validate_close_preview($source,['totalSales'=>500],$source['opened_at']),409);
rejects(fn()=>shift_validate_close_preview($source,[],'2026-10-21 17:43:26'),409);
echo "PASS: correction, authorization, review conflicts, rollback, audit, summaries, stale-day acknowledgement\n";
