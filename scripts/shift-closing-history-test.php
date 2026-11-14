<?php
declare(strict_types=1);
require __DIR__.'/takeaway-business-shifts-test.php';
require __DIR__.'/../public/api/_lib/shift_closing_reports.php';
$history=shift_closing_history($p,'cart',['id'=>'u1','role'=>'user']);
check(count($history['items'])===1,'Cashier sees only their own closed sessions');
check($history['items'][0]['summary']['totalSales']==500,'Takeaway history uses persisted closing snapshot');
check(!shift_closing_history($p,'other',['id'=>'u2','role'=>'user'])['items'],'History is scoped to store and cashier');
check(count(shift_closing_history($p,'cart',['id'=>'admin','role'=>'admin'])['items'])===3,'Admin sees closed sessions across cashiers');
reject(fn()=>shift_closing_report($p,'cart',$id4,['id'=>'u1','role'=>'user']),403);
$p->exec("INSERT INTO cashier_shifts(id,store_id,cashier_uid,cashier_name,shift_type,status,opening_cash,closing_cash,opened_at,closed_at,cash_sales,transfer_sales,total_sales,expected_closing_cash) VALUES
('cafe-one','cart','u1','One','shift_1','closed',100,300,'2026-11-10 07:00:00','2026-11-10 12:00:00',200,300,500,300),
('cafe-last','cart','u1','One','shift_3','closed',100,400,'2026-11-10 17:00:00','2026-11-10 23:00:00',300,100,400,400)");
$legacy=shift_closing_report($p,'cart','cafe-last',['id'=>'u1','role'=>'user']);
check($legacy['isFinalShift'] && $legacy['cycle']['totalSales']==900,'Cafe final shift includes whole-day totals');
check($legacy['cycle']['actualHandover']==500,'Cafe history preserves closing cash accounting');
reject(fn()=>shift_closing_report($p,'cart',$next['item']['id'],['id'=>'u1','role'=>'user']),409);
echo "PASS closing history: ownership/store scope, legacy cafe, final totals and saved takeaway snapshots\n";
