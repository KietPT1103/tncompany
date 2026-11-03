<?php
declare(strict_types=1);
require_once __DIR__ . '/../public/api/_lib/employee_cleanup.php';
function check(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
$db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$db->exec('PRAGMA foreign_keys = ON');
$db->exec('CREATE TABLE employees (id TEXT PRIMARY KEY, store_id TEXT)');
$db->exec('CREATE TABLE payrolls (id TEXT PRIMARY KEY, store_id TEXT, period_end TEXT)');
$db->exec('CREATE TABLE payroll_entries (id TEXT PRIMARY KEY, payroll_id TEXT, employee_id TEXT, employee_name TEXT, salary INT, FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE SET NULL)');
$db->exec("INSERT INTO employees VALUES ('a','cafe'),('b','cafe'),('c','cafe'),('foreign','farm')");
$db->exec("INSERT INTO payrolls VALUES ('p1','cafe','2026-08-31'),('p2','cafe','2026-07-31'),('p3','farm','2026-12-31'),('p4','cafe',NULL)");
$db->exec("INSERT INTO payroll_entries VALUES ('e1','p1','a','Alice',100),('e2','p2','a','Alice',90),('e3','p3','a','Alice',200),('e4','p4','c','Carol',50)");
$summary = employees_payroll_summary($db, 'cafe');
check($summary['a']['lastPayrollDate'] === '2026-08-31', 'latest period by date, scoped to store');
check($summary['a']['payrollCount'] === 2, 'count only same-store history');
check(!isset($summary['b']), 'never paid has no summary');
check($summary['c']['lastPayrollDate'] === null && $summary['c']['payrollCount'] === 1, 'undated history distinct from never paid');
try { employees_delete_many($db, 'cafe', ['a','foreign']); throw new RuntimeException('cross-store deletion accepted'); }
catch (InvalidArgumentException $e) { check((int)$db->query('SELECT COUNT(*) FROM employees')->fetchColumn() === 4, 'invalid batch is atomic'); }
check(employees_delete_many($db, 'cafe', ['a','b','a']) === 2, 'deduplicated selected deletion');
check((int)$db->query('SELECT COUNT(*) FROM payroll_entries')->fetchColumn() === 4, 'payroll history preserved');
check($db->query("SELECT employee_name FROM payroll_entries WHERE id='e1'")->fetchColumn() === 'Alice', 'snapshot name retained');
check((int)$db->query("SELECT COUNT(*) FROM employees WHERE store_id='farm'")->fetchColumn() === 1, 'other store retained');
$db->exec("CREATE TRIGGER stop_delete BEFORE DELETE ON employees WHEN OLD.id='c' BEGIN SELECT RAISE(ABORT,'blocked'); END");
try { employees_delete_many($db, 'cafe', ['c']); } catch (PDOException $e) { }
check(!$db->inTransaction() && (int)$db->query("SELECT COUNT(*) FROM employees WHERE id='c'")->fetchColumn() === 1, 'database error rolls back transaction');
echo "employee cleanup behavior tests passed\n";
