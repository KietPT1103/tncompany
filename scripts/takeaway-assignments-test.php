<?php
require_once __DIR__.'/../public/api/_lib/takeaway_assignments.php';
$pdo=new PDO('sqlite::memory:'); $pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$pdo->exec('CREATE TABLE stores(id TEXT PRIMARY KEY,is_take_away INTEGER,takeaway_shift_enabled INTEGER,takeaway_shift_count INTEGER,deleted_at TEXT)');
$pdo->exec("INSERT INTO stores VALUES ('tea',1,1,12,NULL),('cafe',0,1,3,NULL),('old',1,0,3,NULL)");
takeaway_assignments_ensure_schema($pdo);
function check($actual,$expected) { if($actual!==$expected) throw new Exception(var_export([$actual,$expected],true)); }
check(takeaway_assignments_validate($pdo,['tea'=>10],['tea']),['tea'=>10]);
foreach ([['tea'=>0],['tea'=>13],['tea'=>1.5],['tea'=>'2'],['cafe'=>1],['old'=>1],['missing'=>1]] as $invalid) {
 try { takeaway_assignments_validate($pdo,$invalid,['tea','cafe','old']); throw new Exception('Accepted invalid assignment'); } catch (InvalidArgumentException $e) {}
}
try { takeaway_assignments_validate($pdo,['tea'=>1],[]); throw new Exception('Accepted inaccessible store'); } catch (InvalidArgumentException $e) {}
takeaway_assignments_write($pdo,'u',['tea'=>10]); check(takeaway_assignments_read($pdo,'u'),['tea'=>10]);
$pdo->beginTransaction(); takeaway_assignments_write($pdo,'u',['tea'=>2]); $pdo->rollBack(); check(takeaway_assignments_read($pdo,'u'),['tea'=>10]);
takeaway_assignments_write($pdo,'u',[]); check(takeaway_assignments_read($pdo,'u'),[]);
echo "PASS takeaway assignment validation and persistence\n";
