<?php
declare(strict_types=1);
require __DIR__.'/../public/api/_lib/payroll_estimates.php';
function verify(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
$pdo = new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE payrolls (id TEXT,store_id TEXT,name TEXT,source TEXT,status TEXT,period_start TEXT,period_end TEXT,created_at TEXT,updated_at TEXT)');
$pdo->exec('CREATE TABLE payroll_entries (id TEXT,payroll_id TEXT,employee_id TEXT,total_hours REAL,salary REAL)');
$pdo->exec("INSERT INTO payrolls VALUES
 ('new','cafe','Lịch tháng 10','payroll_estimate','draft','2026-10-05','2026-10-11','2026-10-08','2026-10-09'),
 ('old','cafe','Ước tính lương 28-09 - 04-10','timesheet_import','draft','2026-09-28','2026-10-04','2026-10-01',NULL),
 ('actual','cafe','Bảng lương tháng 10','timesheet_import','draft','2026-10-01','2026-10-31','2026-10-10',NULL),
 ('other','restaurant','Lịch bếp','payroll_estimate','draft','2026-10-05','2026-10-11','2026-10-10',NULL)");
$pdo->exec("INSERT INTO payroll_entries VALUES ('e1','new','a',5,100000),('e2','new','b',6,0),('e3','old','a',10,200000),('e4','other','a',10,999999)");
$list = payroll_estimates_list($pdo,'cafe',1);
verify($list['total'] === 2 && count($list['items']) === 2,'Only saved estimates for selected store, including legacy records');
verify($list['items'][0]['id'] === 'new','Most recently updated schedules first');
verify($list['items'][0]['employeeCount'] === 2 && $list['items'][0]['totalHours'] === 11.0 && $list['items'][0]['totalSalary'] === 100000.0,'Totals include hourly and fixed-salary staff without duplicating salary');
$detail = payroll_estimates_detail($pdo,'cafe','new');
verify($detail !== null && $detail['schedule']['endDate'] === '2026-10-11' && count($detail['entries']) === 2,'Reopen preserves full saved period even when shifts cover only some days');
verify(payroll_estimates_detail($pdo,'cafe','other') === null && payroll_estimates_detail($pdo,'cafe','actual') === null,'Cannot reopen schedules from another store or actual payroll');
verify(count(payroll_estimates_list($pdo,'cafe',2)['items']) === 0,'Pagination beyond last page is empty');
$insert = $pdo->prepare("INSERT INTO payrolls VALUES (?, 'cafe','Estimate','payroll_estimate','draft','2026-10-05','2026-10-11','2026-10-08',NULL)");
for ($i=0;$i<15;$i++) $insert->execute(['p'.$i]);
verify(count(payroll_estimates_list($pdo,'cafe',1)['items']) === 10 && count(payroll_estimates_list($pdo,'cafe',2)['items']) === 7,'Ten schedules per page');
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
echo "PASS saved schedules: estimates, store isolation, totals, full date range, pagination and deletion\n";
