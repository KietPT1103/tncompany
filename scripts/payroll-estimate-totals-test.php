<?php
declare(strict_types=1);
require __DIR__.'/../public/api/_lib/payroll_estimates.php';
$pdo = new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE payrolls(id TEXT,store_id TEXT,name TEXT,source TEXT,status TEXT,period_start TEXT,period_end TEXT,created_at TEXT,updated_at TEXT)');
$pdo->exec('CREATE TABLE payroll_entries(id TEXT,payroll_id TEXT,employee_id TEXT,role TEXT,hourly_rate REAL,salary_type TEXT,monthly_salary REAL,fixed_salary REAL,total_hours REAL,salary REAL,shifts_json TEXT)');
$pdo->exec("INSERT INTO payrolls VALUES ('p','cafe','Ước tính lương 05-10 - 11-10','payroll_estimate','draft','2026-10-05','2026-10-11','2026-10-08',NULL)");
$insert = $pdo->prepare('INSERT INTO payroll_entries VALUES (?,?,?,?,?,?,?,?,?,?,?)');
$shift = fn($date,$start,$end,$hours,$role)=>['date'=>$date,'inTime'=>$date.'T'.$start,'outTime'=>$date.'T'.$end,'hours'=>$hours,'role'=>$role,'isValid'=>true];
$insert->execute(['hourly','p','deleted','Pha chế',20000,'hourly',0,0,5,100000,json_encode([$shift('2026-10-05','07:00','12:00',5,'Pha chế')])]);
$insert->execute(['monthly','p','monthly-person','Pha chế',0,'monthly',9000000,9000000,10,0,json_encode([$shift('2026-10-05','07:00','12:00',5,'Pha chế'),$shift('2026-10-05','12:00','17:00',5,'Thu ngân')])]);
function check(bool $ok,string $message): void { if (!$ok) throw new RuntimeException($message); }
$list = payroll_estimates_list($pdo,'cafe',1,'2026-10-05','2026-10-11');
$detail = payroll_estimates_detail($pdo,'cafe','p');
check($list['items'][0]['totalSalary'] === 400000.0,'List recalculates old zero monthly salary from saved monthly snapshot');
check($list['items'][0]['employeeCount'] === 2 && $list['items'][0]['totalHours'] === 15.0,'Deleted employee remains in saved totals');
check($detail['schedule']['totalSalary'] === $list['items'][0]['totalSalary'] && $list['summary']['totalSalary'] === 400000.0,'List, detail and period summary agree');
check((float)$pdo->query("SELECT salary FROM payroll_entries WHERE id='monthly'")->fetchColumn() === 0.0,'Read recalculation does not rewrite saved records');
$entries = $detail['entries'];
$entries[1]['shifts_json'] = json_encode([$shift('2026-10-05','07:00','12:00',5,'Pha chế'),$shift('2026-10-06','07:00','12:00',5,'Pha chế')]);
check(payroll_estimates_totals($entries,'2026-10-05','2026-10-11')['total_salary'] === 700000.0,'Monthly cost counts one daily salary per day');
echo "PASS saved estimate totals: monthly staff, multiple roles, removed profiles, list/detail/summary consistency, no read writes\n";
