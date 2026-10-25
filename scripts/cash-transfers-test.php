<?php
require_once __DIR__ . '/../public/api/_lib/cash_transfers.php';
$p=new PDO('sqlite::memory:');$p->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$p->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);
$p->exec("CREATE TABLE cash_vouchers(id TEXT,code TEXT,store_id TEXT,voucher_type TEXT,amount REAL,include_in_cash_flow INTEGER,cancelled_at TEXT,shift_id TEXT,cashier_id TEXT); CREATE TABLE cashier_shifts(id TEXT,store_id TEXT,cashier_uid TEXT,shift_type TEXT,status TEXT,opened_at TEXT,opening_cash REAL,closing_cash REAL); CREATE TABLE bills(id TEXT,store_id TEXT,shift_id TEXT,status TEXT,payment_method TEXT,total REAL)");
cash_transfers_ensure_schema($p);cash_transfers_ensure_schema($p);
$p->exec("INSERT INTO cashier_shifts VALUES('s1','cafe','old','shift_1','closed','2026-10-26 07:00:00',100,10000100),('s2','cafe','old','shift_2','closed','2026-10-26 12:00:00',100,10000100),('s3','cafe','u','shift_3','open','2026-10-26 17:00:00',100,NULL)");
$u=['id'=>'u','role'=>'user'];$b=['storeId'=>'cafe','type'=>'income','amount'=>10000000,'includeInCashFlow'=>true,'sourceShiftId'=>'s1','shiftId'=>'s3','transferRequestId'=>'retry-1'];
function check($ok,$message){if(!$ok)throw new Exception($message);}
function reject($p,$b,$u,$message){try{cash_transfers_prepare($p,$b,$u,'cafe');}catch(CashTransferError $e){return;}throw new Exception($message);}
$p->beginTransaction();$r=cash_transfers_prepare($p,$b,$u,'cafe');check($r['shiftId']==='s3','automatic receiver');
$p->prepare('INSERT INTO cash_vouchers VALUES(?,?,?,?,?,?,?,?,?,?,?)')->execute(['v1','T1','cafe','income',10000000,1,null,'s3','u','s1','retry-1']);$p->commit();
check(cash_transfers_outgoing($p,'cafe','s1')===10000000.0,'source withdrawn once');
check(cash_transfers_prepare($p,$b,$u,'cafe')['existingId']==='v1','retry returns original');
reject($p,array_replace($b,['amount'=>1]),$u,'retry payload conflict');
reject($p,array_replace($b,['transferRequestId'=>'new','amount'=>1]),$u,'overdraw');
reject($p,array_replace($b,['shiftId'=>'s2','transferRequestId'=>'new']),$u,'receiver spoof');
reject($p,array_replace($b,['sourceShiftId'=>'s3','transferRequestId'=>'new']),$u,'self transfer');
reject($p,array_replace($b,['type'=>'expense','transferRequestId'=>'new']),$u,'expense transfer');
reject($p,array_replace($b,['includeInCashFlow'=>false,'transferRequestId'=>'new']),$u,'excluded transfer');
reject($p,array_replace($b,['transferRequestId'=>'new']),['id'=>'other','role'=>'admin'],'foreign receiver');
$p->exec("UPDATE cash_vouchers SET cancelled_at='2026-10-26 18:00:00' WHERE id='v1'");
check(cash_transfers_outgoing($p,'cafe','s1')===0.0,'cancellation reverses derived withdrawal');
check(cash_transfers_report($p,'cafe','2026-10-26','2026-10-26')===[],'cancelled omitted');
reject($p,array_replace($b,['transferRequestId'=>'']),$u,'request key required');
$p->exec("UPDATE cashier_shifts SET opened_at='2026-10-25 07:00:00' WHERE id='s1'");
reject($p,array_replace($b,['transferRequestId'=>'new']),$u,'cross day');
$p->exec("UPDATE cashier_shifts SET opened_at='2026-10-26 07:00:00',store_id='bakery' WHERE id='s1'");
reject($p,array_replace($b,['transferRequestId'=>'new']),$u,'cross store');
$p->exec("UPDATE cashier_shifts SET store_id='cafe',status='open',closing_cash=NULL WHERE id='s1'; INSERT INTO bills VALUES('bill1','cafe','s1','completed','cash',10000000); INSERT INTO bills VALUES('bill2','cafe','s1','completed','transfer',90000000)");
check(cash_transfers_prepare($p,array_replace($b,['transferRequestId'=>'open-source']),$u,'cafe')['sourceShiftId']==='s1','open source live cash');
$p->exec("INSERT INTO cash_vouchers VALUES('expense','C1','cafe','expense',1000000,1,NULL,'s1','old',NULL,NULL)");
reject($p,array_replace($b,['transferRequestId'=>'new']),$u,'open source expense reduces available');
$p->exec("INSERT INTO cash_vouchers VALUES('income','T2','cafe','income',2000000,1,NULL,'s1','old','s2','prior-request')");
check(cash_transfers_prepare($p,array_replace($b,['amount'=>11000000,'transferRequestId'=>'chained']),$u,'cafe')['shiftId']==='s3','prior incoming funds included once');
$p->exec("INSERT INTO cash_vouchers VALUES('out','T3','cafe','income',3000000,1,NULL,'s3','u','s1','prior-out')");
reject($p,array_replace($b,['amount'=>9000000,'transferRequestId'=>'new']),$u,'prior outgoing reduces available');
check(cash_transfers_outgoing($p,'cafe','s1')===3000000.0,'only active included source incomes count');
$report=cash_transfers_report($p,'cafe','2026-10-26','2026-10-26');
check(count($report)===2 && $report[0]['source_label']!==$report[0]['receiver_label'],'stored labels from relation');
check(cash_transfers_prepare($p,['amount'=>1],$u,'cafe')['sourceShiftId']===null,'ordinary voucher remains nullable');
try{$p->exec("INSERT INTO cash_vouchers VALUES('dup','T4','cafe','income',1,1,NULL,'s3','u','s1','prior-out')");throw new Exception('duplicate key accepted');}catch(PDOException $e){}
// Two SQLite WAL readers may validate the old balance, but the stale writer cannot commit.
$raceFile = tempnam(sys_get_temp_dir(), 'cash-transfer-race-');
unlink($raceFile);
$p->exec('VACUUM INTO ' . $p->quote($raceFile));
$first = new PDO('sqlite:' . $raceFile);
$second = new PDO('sqlite:' . $raceFile);
foreach ([$first,$second] as $connection) {
    $connection->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
    $connection->exec('PRAGMA journal_mode=WAL');
    $connection->exec('PRAGMA busy_timeout=50');
    $connection->beginTransaction();
}
$raceBody=array_replace($b,['amount'=>8000000,'transferRequestId'=>'race-first']);
cash_transfers_prepare($first,$raceBody,$u,'cafe');
cash_transfers_prepare($second,array_replace($raceBody,['transferRequestId'=>'race-second']),$u,'cafe');
$insert='INSERT INTO cash_vouchers VALUES(?,?,?,?,?,?,?,?,?,?,?)';
$first->prepare($insert)->execute(['race-first','R1','cafe','income',8000000,1,null,'s3','u','s1','race-first']);
$first->commit();
try {
    $second->prepare($insert)->execute(['race-second','R2','cafe','income',8000000,1,null,'s3','u','s1','race-second']);
    throw new Exception('stale concurrent writer accepted');
} catch (PDOException $error) {
    check(str_contains($error->getMessage(),'locked'),'stale writer rejected by SQLite isolation');
}
$second->rollBack();
reject($second,array_replace($raceBody,['transferRequestId'=>'race-second']),$u,'retry after concurrent transfer must recheck balance');
unset($connection,$error);
$first=null;$second=null;
foreach ([$raceFile,$raceFile.'-wal',$raceFile.'-shm'] as $file) if(is_file($file)) unlink($file);
echo "cash transfers: schema/retry/guards/cancellation/chained balance/report/concurrent stale-writer checks passed\n";
