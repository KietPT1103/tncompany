<?php
declare(strict_types=1);
require __DIR__.'/../public/api/_lib/daily_profit.php';
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE cashier_shifts(id TEXT,store_id TEXT,shift_type TEXT,status TEXT,opened_at TEXT,opening_cash REAL,closing_cash REAL)');
$pdo->exec('CREATE TABLE bills(shift_id TEXT,store_id TEXT,total REAL,status TEXT,payment_method TEXT,created_at TEXT)');
$pdo->exec('CREATE TABLE cash_vouchers(id TEXT,store_id TEXT,shift_id TEXT,source_shift_id TEXT,voucher_type TEXT,amount REAL,cancelled_at TEXT,include_in_cash_flow INTEGER,happened_at TEXT)');
$pdo->exec("INSERT INTO cashier_shifts VALUES ('s1','cafe','shift_1','closed','2026-11-15 07:00:00',100000,1000000),('s2','cafe','shift_2','closed','2026-11-15 12:00:00',100000,500000),('foreign','restaurant','single','closed','2026-11-15 07:00:00',0,999999)");
$pdo->exec("INSERT INTO cash_vouchers VALUES ('transfer','cafe','s2','s1','income',200000,NULL,1,'2026-11-15 12:00:00')");
$handover=profit_source_handover($pdo,'cafe',['2026-11-15'])['2026-11-15'];
check($handover['amount']===1100000.0&&!$handover['provisional'],'Handover excludes opening floats and avoids counting inter-shift transfers twice');
$source=['revenue'=>2000000,'sales'=>[['key'=>'a','name'=>'A','quantity'=>1,'unitCost'=>500000]],'vouchers'=>[['amount'=>200000]],'salaryEstimate'=>['amount'=>100000],'handover'=>$handover];
$inputs=['salary'=>0,'electricity'=>0,'water'=>0,'other'=>0,'marketing'=>0,'operatingExpense'=>10000,'salaryPaid'=>300000,'taxPaid'=>20000,'ingredientInventory'=>999999,'debt'=>999999,'costOverrides'=>[]];
$snapshot=profit_period_snapshot(['2026-11-15'=>$source],['2026-11-15'=>$inputs]);
check((float)$snapshot['totals']['grossProfit']===1500000.0,'Gross profit is revenue less system cost of goods sold');
check($snapshot['totals']['netProfit']===1300000.0,'Net profit excludes informational inventory/payables and cashier payments already accounted for');
check($snapshot['totals']['cashFlow']===770000.0,'Actual cash deducts actual payroll and tax only once');
daily_profit_ensure_schema($pdo);
daily_profit_save($pdo,'cafe','2026-11-15',$snapshot['days'][0]['inputs'],'admin');
$saved=daily_profit_saved_row($pdo->query('SELECT * FROM daily_profit_inputs')->fetch());
check($saved['inputs']['salaryPaid']===300000.0 || $saved['inputs']['salaryPaid']===300000,'Actual salary payment survives persistence');
$accrued=$inputs;$accrued['other']=1234;
$withAccrual=profit_period_snapshot(['2026-11-15'=>$source],['2026-11-15'=>$accrued]);
check($withAccrual['totals']['cashFlow']===$snapshot['totals']['cashFlow'],'Accrued consumable cost does not reduce actual cash again');
check($withAccrual['totals']['netProfit']===$snapshot['totals']['netProfit']-1234,'Accrued consumable cost still reduces net profit');
check(profit_salary_payment_period('2026-12-05')['startDate']==='2026-11-16','Second salary period is previous month');
try{profit_period_snapshot(['2026-11-14'=>$source],['2026-11-14'=>$inputs]);throw new RuntimeException('Must reject payroll on another day');}catch(InvalidArgumentException $e){}
$source['handover']['provisional']=true;
check(profit_period_snapshot(['2026-11-15'=>$source],['2026-11-15'=>$inputs])['totals']['cashFlow']===null,'Unclosed handover is not presented as actual cash');
echo "PASS financial metrics: system handover, store scope, transfers, gross/net/cash, payment dates, no inventory/debt double counting\n";
