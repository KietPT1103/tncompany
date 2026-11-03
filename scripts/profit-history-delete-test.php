<?php
declare(strict_types=1);
require __DIR__.'/../public/api/_lib/daily_profit.php';
$pdo = new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
daily_profit_ensure_schema($pdo);
profit_history_ensure_schema($pdo);
$insert = $pdo->prepare('INSERT INTO profit_report_history (id,store_id,start_date,end_date,snapshot_json,saved_by,saved_at) VALUES (?,?,?,? ,?,?,?)');
foreach ([['a','cafe'],['b','cafe'],['c','restaurant']] as [$id,$store]) $insert->execute([$id,$store,'2026-11-03','2026-11-03','{}','test','2026-11-03']);
daily_profit_save($pdo,'cafe','2026-11-03',['other'=>150000,'marketing'=>0],'test');
function verify(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
verify(!profit_history_delete($pdo,'cafe','c'),'Cannot delete another store report');
verify(profit_history_delete($pdo,'cafe','a'),'Deletes selected report');
verify(!profit_history_delete($pdo,'cafe','a'),'Repeated delete returns not found');
verify((int)$pdo->query('SELECT COUNT(*) FROM profit_report_history')->fetchColumn() === 2,'Other snapshots remain');
verify(daily_profit_load($pdo,'cafe','2026-11-03')['inputs']['other'] === 150000,'Daily cost inputs remain intact');
foreach (['',str_repeat('x',65)] as $id) {
    try { profit_history_delete($pdo,'cafe',$id); } catch (InvalidArgumentException $e) { continue; }
    throw new RuntimeException('Invalid ID must be rejected');
}
echo "PASS delete history: selected snapshot only, store scope, stale ids, validation, daily inputs preserved\n";
