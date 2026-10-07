<?php
declare(strict_types=1);
require __DIR__.'/../public/api/_lib/payroll_estimates.php';
function verify(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
$pdo = new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE payrolls (id TEXT,store_id TEXT,name TEXT,source TEXT,status TEXT,period_start TEXT,period_end TEXT,created_at TEXT,updated_at TEXT)');
$pdo->exec('CREATE TABLE payroll_entries (id TEXT,payroll_id TEXT,employee_id TEXT,total_hours REAL,salary REAL,role TEXT DEFAULT "",shifts_json TEXT DEFAULT "[]")');
$pdo->exec("INSERT INTO payrolls VALUES
 ('new','cafe','Lịch tháng 10','payroll_estimate','draft','2026-10-05','2026-10-11','2026-10-08','2026-10-09'),
 ('old','cafe','Ước tính lương 28-09 - 04-10','timesheet_import','draft','2026-09-28','2026-10-04','2026-10-01',NULL),
 ('actual','cafe','Bảng lương tháng 10','timesheet_import','draft','2026-10-01','2026-10-31','2026-10-10',NULL),
 ('other','restaurant','Lịch bếp','payroll_estimate','draft','2026-10-05','2026-10-11','2026-10-10',NULL)");
$pdo->exec("INSERT INTO payroll_entries (id,payroll_id,employee_id,total_hours,salary) VALUES ('e1','new','a',5,100000),('e2','new','b',6,0),('e3','old','a',10,200000),('e4','other','a',10,999999)");
$pdo->exec("UPDATE payroll_entries SET role='Phục vụ' WHERE id='e1'");
$pdo->exec("UPDATE payroll_entries SET role='Thu ngân' WHERE id='e2'");
$list = payroll_estimates_list($pdo,'cafe',1);
verify($list['total'] === 2 && count($list['items']) === 2,'Only saved estimates for selected store, including legacy records');
verify($list['items'][0]['id'] === 'new','Most recently updated schedules first');
verify($list['items'][0]['employeeCount'] === 2 && $list['items'][0]['totalHours'] === 11.0 && $list['items'][0]['totalSalary'] === 100000.0,'Totals include hourly and fixed-salary staff without duplicating salary');
verify($list['items'][0]['roles'] === ['Phục vụ','Thu ngân'], 'Saved schedule shows all assigned roles');
verify(payroll_estimates_roles([
    ['role'=>'Phục vụ','shifts_json'=>json_encode([['role'=>'Phục vụ'],['role'=>'Thu ngân'],['role'=>'Decor'],['role'=>'Thu ngân']])],
]) === ['Phục vụ','Thu ngân','Decor'], 'One employee assigned across multiple boards keeps each shift role');
verify(payroll_estimates_roles([['role'=>'Pha chế','shifts_json'=>'[{"isValid":true}]']]) === ['Pha chế'], 'Legacy shifts without per-shift roles use employee entry role');
foreach ([['2026-02-30','2026-10-11'],['2026-10-05',''],['2026-10-12','2026-10-11']] as [$invalidStart,$invalidEnd]) {
    $rejected = false;
    try { payroll_estimates_list($pdo,'cafe',1,$invalidStart,$invalidEnd); } catch (InvalidArgumentException $exception) { $rejected = true; }
    verify($rejected, 'Reject invalid, incomplete or reversed period boundaries');
}
$pdo->exec("INSERT INTO payrolls VALUES ('duplicate','cafe','Another role sheet','payroll_estimate','draft','2026-10-05','2026-10-11','2026-10-08',NULL),('overlap','cafe','Different range','payroll_estimate','draft','2026-10-06','2026-10-11','2026-10-08',NULL)");
$pdo->exec("INSERT INTO payroll_entries (id,payroll_id,employee_id,total_hours,salary,role) VALUES ('dup','duplicate','a',5,150000,'Phục vụ'),('over','overlap','a',5,999999,'Decor')");
$filtered = payroll_estimates_list($pdo,'cafe',1,'2026-10-05','2026-10-11');
verify($filtered['total'] === 2 && $filtered['summary']['totalSalary'] === 250000.0 && $filtered['summary']['totalHours'] === 16.0, 'Sum ALL schedules sharing exact boundaries, including the same role');
verify($filtered['summary']['employeeCount'] === 2 && $filtered['summary']['scheduleCount'] === 2, 'Count unique employees and all schedules across the period');
$pageTwo = payroll_estimates_list($pdo,'cafe',2,'2026-10-05','2026-10-11');
verify($pageTwo['items'] === [] && $pageTwo['summary'] === $filtered['summary'], 'Totals include every matching schedule, independently of pagination');
verify(payroll_estimates_list($pdo,'cafe',1,'2026-10-01','2026-10-31')['summary']['totalSalary'] === 0.0, 'Monthly range does not include weekly schedules with different boundaries');
$pdo->exec("DELETE FROM payroll_entries WHERE payroll_id IN ('duplicate','overlap')");
$pdo->exec("DELETE FROM payrolls WHERE id IN ('duplicate','overlap')");
$detail = payroll_estimates_detail($pdo,'cafe','new');
verify($detail !== null && $detail['schedule']['endDate'] === '2026-10-11' && count($detail['entries']) === 2,'Reopen preserves full saved period even when shifts cover only some days');
verify(payroll_estimates_detail($pdo,'cafe','other') === null && payroll_estimates_detail($pdo,'cafe','actual') === null,'Cannot reopen schedules from another store or actual payroll');
verify(count(payroll_estimates_list($pdo,'cafe',2)['items']) === 0,'Pagination beyond last page is empty');
$insert = $pdo->prepare("INSERT INTO payrolls VALUES (?, 'cafe','Estimate','payroll_estimate','draft','2026-10-05','2026-10-11','2026-10-08',NULL)");
for ($i=0;$i<15;$i++) $insert->execute(['p'.$i]);
verify(count(payroll_estimates_list($pdo,'cafe',1)['items']) === 10 && count(payroll_estimates_list($pdo,'cafe',2)['items']) === 7,'Ten schedules per page');
$pdo->exec("INSERT INTO payroll_entries (id,payroll_id,employee_id,total_hours,salary,role) VALUES ('lastpage','p0','c',5,12345,'Decor')");
$allPages = payroll_estimates_list($pdo,'cafe',1,'2026-10-05','2026-10-11');
verify($allPages['summary']['scheduleCount'] === 16 && $allPages['summary']['totalSalary'] === 112345.0, 'Summary includes matching salary from beyond the visible ten schedules');
$pdo->exec("DELETE FROM payroll_entries WHERE id='lastpage'");
verify(!payroll_estimates_delete($pdo,'cafe','other'), 'Cannot delete another store schedule');
verify(!payroll_estimates_delete($pdo,'cafe','actual'), 'Cannot delete actual payroll through saved schedules');
verify(payroll_estimates_detail($pdo,'restaurant','other') !== null, 'Other store data remains intact');
verify(payroll_estimates_delete($pdo,'cafe','new'), 'Delete selected saved estimate');
verify(payroll_estimates_detail($pdo,'cafe','new') === null, 'Deleted estimate no longer appears');
verify((int)$pdo->query("SELECT COUNT(*) FROM payroll_entries WHERE payroll_id='new'")->fetchColumn() === 0, 'Delete associated estimate entries');
verify((int)$pdo->query("SELECT COUNT(*) FROM payroll_entries WHERE payroll_id='old'")->fetchColumn() === 1, 'Other estimate entries remain intact');
verify(!payroll_estimates_delete($pdo,'cafe','new'), 'Repeated deletion returns not found');
$pdo->exec("CREATE TRIGGER reject_entry_delete BEFORE DELETE ON payroll_entries WHEN OLD.payroll_id='old' BEGIN SELECT RAISE(ABORT,'test failure'); END");
$failed = false;
try { payroll_estimates_delete($pdo,'cafe','old'); } catch (Throwable $exception) { $failed = true; }
verify($failed && payroll_estimates_detail($pdo,'cafe','old') !== null, 'Entry deletion failure rolls back the schedule deletion');
verify((int)$pdo->query("SELECT COUNT(*) FROM payroll_entries WHERE payroll_id='old'")->fetchColumn() === 1, 'Rollback preserves schedule entries');
$pdo->exec("INSERT INTO payroll_entries (id,payroll_id,employee_id,total_hours,salary) VALUES ('batch0','p0','a',5,100000),('batch1','p1','a',5,100000),('batch2','p2','a',5,100000)");
verify(payroll_estimates_delete_many($pdo,'cafe',['p0','p1']), 'Delete multiple selected schedules');
verify(payroll_estimates_detail($pdo,'cafe','p0') === null && payroll_estimates_detail($pdo,'cafe','p1') === null, 'All selected schedules are deleted');
verify((int)$pdo->query("SELECT COUNT(*) FROM payroll_entries WHERE payroll_id IN ('p0','p1')")->fetchColumn() === 0, 'Remove entries for all selected schedules');
verify((int)$pdo->query("SELECT COUNT(*) FROM payroll_entries WHERE payroll_id='p2'")->fetchColumn() === 1, 'Unselected schedule entries remain intact');
verify(!payroll_estimates_delete_many($pdo,'cafe',['p2','other']), 'Reject batch containing another store');
verify(payroll_estimates_detail($pdo,'cafe','p2') !== null, 'Invalid batch does not partially delete');
verify(!payroll_estimates_delete_many($pdo,'cafe',['p2','actual']), 'Reject batch containing actual payroll');
verify(!payroll_estimates_delete_many($pdo,'cafe',['p2','missing']), 'Reject stale selection atomically');
foreach ([[], ['p2','p2'], [''], [123], array_fill(0,101,'p2')] as $ids) {
    $invalid = false;
    try { payroll_estimates_delete_many($pdo,'cafe',$ids); } catch (InvalidArgumentException $exception) { $invalid = true; }
    verify($invalid, 'Validate selected ids and batch size');
}
$failed = false;
try { payroll_estimates_delete_many($pdo,'cafe',['p2','old']); } catch (Throwable $exception) { $failed = true; }
verify($failed && payroll_estimates_detail($pdo,'cafe','p2') !== null && payroll_estimates_detail($pdo,'cafe','old') !== null, 'Bulk failure rolls back every schedule');
verify((int)$pdo->query("SELECT COUNT(*) FROM payroll_entries WHERE payroll_id='p2'")->fetchColumn() === 1, 'Bulk failure restores entries already deleted earlier in the batch');
echo "PASS saved schedules: estimates, store isolation, totals, full date range, pagination and deletion\n";
