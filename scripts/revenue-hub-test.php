<?php
$authSource = file_get_contents(__DIR__ . '/../public/api/_lib/auth.php');
eval(str_replace('<?php', '', str_replace('auth_ensure_tables();', '', str_replace('__DIR__', var_export(realpath(__DIR__ . '/../public/api/_lib'), true), $authSource))));
require __DIR__ . '/../public/api/_lib/revenue_hub.php';
function check($value, $message) { if (!$value) throw new RuntimeException($message); }
check(!auth_has_permission(['role'=>'admin','permissions'=>[]], 'revenue_hub.view'), 'Admin must explicitly opt in');
check(auth_has_permission(['role'=>'admin','permissions'=>['revenue_hub.view']], 'revenue_hub.view'), 'Explicit admin grant');
check(!in_array('revenue_hub.view', auth_default_permissions_for_role('admin')), 'No default grant');
check(!in_array('revenue_hub.view', auth_effective_permissions(['role'=>'admin','permissions_json'=>null])), 'Stored admin defaults');
foreach ([['2026-02-30','2026-03-01'],['2026-10-02','2026-10-01'],['2026-01-01','2026-04-04']] as [$a,$b]) {
    try { revenue_dates($a,$b); throw new RuntimeException('Accepted invalid range'); } catch (InvalidArgumentException $e) {}
}
$p = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$p->exec("CREATE TABLE stores(id TEXT,name TEXT); INSERT INTO stores VALUES('cafe','Nước'),('bakery','Bánh');
CREATE TABLE cashier_shifts(id TEXT,store_id TEXT,shift_type TEXT,opened_at TEXT);
INSERT INTO cashier_shifts VALUES('s1','cafe','shift_1','2026-10-25 06:00:00');
CREATE TABLE bills(id TEXT,store_id TEXT,shift_id TEXT,total REAL,status TEXT,payment_method TEXT,created_at TEXT);
INSERT INTO bills VALUES('a','cafe','s1',100,'completed','cash','2026-10-25 07:00:00'),('b','cafe',NULL,200,'completed','transfer','2026-10-25 08:00:00'),('c','cafe','s1',999,'cancelled','cash','2026-10-25 09:00:00');
CREATE TABLE categories(id TEXT,name TEXT,counts_as_cup INTEGER);
INSERT INTO categories VALUES('drink','Cà phê',1),('cake','Bánh',0);
CREATE TABLE products(store_id TEXT,product_code TEXT,category_id TEXT);
INSERT INTO products VALUES('cafe','coffee','drink'),('cafe','cake','cake');
CREATE TABLE bill_items(bill_id TEXT,menu_id TEXT,quantity REAL,counts_as_cup INTEGER);
INSERT INTO bill_items VALUES('a','coffee',2,NULL),('a','cake',3,1),('b','coffee',1,0),('c','coffee',99,1);
CREATE TABLE cash_vouchers(store_id TEXT,shift_id TEXT,voucher_type TEXT,amount REAL,include_in_cash_flow INTEGER,cancelled_at TEXT,happened_at TEXT);
INSERT INTO cash_vouchers VALUES('cafe','s1','expense',20,1,NULL,'2026-10-25 10:00:00'),('cafe','s1','expense',99,0,NULL,'2026-10-25 10:00:00'),('cafe','s1','expense',88,1,'cancelled','2026-10-25 10:00:00');");
$r = revenue_tn($p,'2026-10-25','2026-10-25','cafe');
check($r['totals']['revenue'] === 300.0, 'Revenue excludes cancelled');
check($r['totals']['cash'] === 100.0 && $r['totals']['transfer'] === 200.0, 'Payments');
check($r['totals']['cups'] === 5.0 && $r['totals']['bakery'] === 3.0, 'Historical cup snapshot is honored independently of bakery, explicit false honored');
check($r['totals']['expense'] === 20.0, 'Only counted expenses');
check($r['days'][0]['shifts']['unassigned']['revenue'] === 200.0, 'Unassigned preserved');
for ($i=0;$i<2100;$i++) $p->exec("INSERT INTO bills VALUES('bulk$i','cafe','s1',1,'completed','cash','2026-10-25 12:00:00')");
check(revenue_tn($p,'2026-10-25','2026-10-25','cafe')['totals']['revenue'] === 2400.0, 'No 2000 bill cap');
check(revenue_tn($p,'2026-10-26','2026-10-26','cafe')['totals']['revenue'] === 0.0, 'Empty day');
echo "TN revenue: PASS\n";
