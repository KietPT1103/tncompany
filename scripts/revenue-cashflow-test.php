<?php
require __DIR__ . '/../public/api/_lib/revenue_cashflow.php';
function cashflow_check($value, string $message): void { if (!$value) throw new RuntimeException($message); }
$shifts = [];
foreach ([1=>10000000,2=>10000000,3=>20000000] as $n=>$cash) {
    $shifts[] = ['id'=>'s'.$n,'store_id'=>'cafe','shift_type'=>'shift_'.$n,'status'=>'closed','opened_at'=>'2026-10-24 '.str_pad((string)($n*5),2,'0',STR_PAD_LEFT).':00:00','opening_cash'=>0,'closing_cash'=>$cash];
}
$bills = array_map(static fn($s)=>['shift_id'=>$s['id'],'total'=>10000000,'status'=>'completed','payment_method'=>'cash'], $shifts);
$vouchers = [['id'=>'v1','store_id'=>'cafe','shift_id'=>'s3','source_shift_id'=>'s1','voucher_type'=>'income','amount'=>10000000,'include_in_cash_flow'=>1,'cancelled_at'=>null]];
$expense = ['complete'=>true,'days'=>[['date'=>'2026-10-24','storeId'=>'cafe','total'=>15000000,'status'=>'ready','lastSyncedAt'=>'2026-10-24T12:00:00Z','error'=>null,'items'=>[['name'=>'Quảng cáo','amount'=>15000000,'row'=>3]]]]];
$r = revenue_cashflow_calculate($shifts,$bills,$vouchers,$expense,['2026-10-24'],['cafe']);
cashflow_check($r['grossHandover'] === 30000000.0,'Internal transfer must not increase day cash');
cashflow_check($r['outsideExpense'] === 15000000.0 && $r['netHandover'] === 15000000.0,'Outside cost deducted once');
cashflow_check(array_column($r['days'][0]['shifts'],'netHandover') === [0.0,10000000.0,5000000.0],'User example 0/10/5');
cashflow_check($r['complete'] && !$r['provisional'],'Verified closed day is final');
$open=$shifts;$open[2]['status']='open';$open[2]['closing_cash']=null;
$r=revenue_cashflow_calculate($open,$bills,$vouchers,$expense,['2026-10-24'],['cafe']);
cashflow_check($r['provisional'] && $r['netHandover']===15000000.0,'Open receiver projected cash counts internal receipt once');
$missing=['complete'=>false,'days'=>[['date'=>'2026-10-24','storeId'=>'cafe','total'=>null,'status'=>'missing','items'=>[]]]];
$r=revenue_cashflow_calculate($shifts,$bills,$vouchers,$missing,['2026-10-24'],['cafe']);
cashflow_check(!$r['complete'] && $r['outsideExpense']===null && $r['netHandover']===null,'Missing sheet cannot become false zero');
$stale=$expense;$stale['days'][0]['status']='stale';
$r=revenue_cashflow_calculate($shifts,$bills,$vouchers,$stale,['2026-10-24'],['cafe']);
cashflow_check($r['days'][0]['syncStatus']==='stale' && $r['netHandover']===15000000.0,'Last good snapshot preserved with visible stale flag');
$cancel=$vouchers;$cancel[0]['cancelled_at']='2026-10-24 20:00:00';
$r=revenue_cashflow_calculate($shifts,$bills,$cancel,$expense,['2026-10-24'],['cafe']);
cashflow_check($r['days'][0]['shifts'][0]['transferOut']===0.0,'Cancelled transfer does not withdraw source');
$empty=$expense;$empty['days'][0]['total']=0;$empty['days'][0]['items']=[];
$r=revenue_cashflow_calculate([],[],[],$empty,['2026-10-24'],['cafe']);
cashflow_check($r['complete'] && $r['netHandover']===0.0,'Successfully synced zero is zero');
$r=revenue_cashflow_calculate($shifts,$bills,$vouchers,$expense,['2026-10-24','2026-10-25'],['cafe']);
cashflow_check(!$r['complete'] && count($r['days'])===2,'Missing day must not be silently dropped');
echo "Cashflow calculation: PASS\n";

// Exercise the actual SQL/report boundary with the same posted example.
require_once __DIR__ . '/../public/api/_lib/revenue_hub.php';
require_once __DIR__ . '/../public/api/_lib/outside_expenses.php';
$p = new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$p->exec("CREATE TABLE stores(id TEXT,name TEXT); INSERT INTO stores VALUES('cafe','Cà phê');
CREATE TABLE cashier_shifts(id TEXT PRIMARY KEY,store_id TEXT,shift_type TEXT,status TEXT,opened_at TEXT,opening_cash REAL,closing_cash REAL);
CREATE TABLE bills(shift_id TEXT,store_id TEXT,total REAL,status TEXT,payment_method TEXT);
CREATE TABLE cash_vouchers(id TEXT PRIMARY KEY,store_id TEXT,shift_id TEXT,voucher_type TEXT,amount REAL,include_in_cash_flow INTEGER,cancelled_at TEXT,source_shift_id TEXT,transfer_request_id TEXT);");
$insert=$p->prepare('INSERT INTO cashier_shifts VALUES(?,?,?,?,?,?,?)');
foreach($shifts as $row)$insert->execute([$row['id'],$row['store_id'],$row['shift_type'],$row['status'],$row['opened_at'],$row['opening_cash'],$row['closing_cash']]);
$p->exec("INSERT INTO bills VALUES('s1','cafe',10000000,'completed','cash'),('s2','cafe',10000000,'completed','cash'),('s3','cafe',10000000,'completed','cash');
INSERT INTO cash_vouchers VALUES('v1','cafe','s3','income',10000000,1,NULL,'s1','transfer1');");
outside_expenses_ensure_schema($p);
$insert=$p->prepare('INSERT INTO outside_expense_sources(month_key,store_id,url,spreadsheet_id,tab_key,sheet_name,last_synced_at) VALUES(?,?,?,?,?,?,?)');
$insert->execute(['2026-10','cafe','https://docs.google.com/spreadsheets/d/fixture12345678901234567890/edit','fixture12345678901234567890','gid:1','Tổng chi T10',date('Y-m-d H:i:s')]);
$p->exec("INSERT INTO outside_expense_items VALUES('2026-10','cafe',3,'2026-10-24',15000000,'Quảng cáo');");
$r=revenue_cashflow($p,'2026-10-24','2026-10-24',['cafe']);
cashflow_check($r['netHandover']===15000000.0,'Real provider queries preserve final15m');
cashflow_check(array_column($r['days'][0]['shifts'],'netHandover')===[0.0,10000000.0,5000000.0],'Real queries preserve individual shift handovers');
echo "Cashflow SQL integration: PASS\n";
