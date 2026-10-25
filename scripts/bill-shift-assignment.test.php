<?php
class Response extends Exception { public function __construct(public int $status) {} }
function respond_error($message, $status) { throw new Response($status); }
function respond_ok($data) { throw new Response(200); }
function pos_assert_record_store(...$args) {}
function realtime_publish(...$args) {}
class FakeStatement {
 public function __construct(private string $sql) {}
 public function execute($params) { $GLOBALS['queries'][] = [$this->sql, $params]; }
 public function fetch() { return str_contains($this->sql, 'cashier_shifts') ? $GLOBALS['shift'] : ['store_id'=>'cafe']; }
 public function fetchColumn() { return 'cafe'; }
}
class FakeDatabase {
 public function prepare($sql) { return new FakeStatement($sql); }
 public function beginTransaction() {}
 public function commit() {}
 public function inTransaction() { return false; }
}
function db() { return new FakeDatabase(); }
$source=file_get_contents(__DIR__.'/../public/api/pos.php');
$start=strpos($source, "if (\$method === 'PATCH' && \$resource === 'bills') {");
$end=strpos($source, "if (\$method === 'DELETE' && \$resource === 'bills') {",$start);
$handler=substr($source,$start,$end-$start);
function runCase($role,$selectedShift,$expected) {
 global $handler,$shift,$queries;
 $queries=[]; $shift=$selectedShift;
 $method='PATCH'; $resource='bills'; $posStoreId='cafe';
 $user=['role'=>$role]; $body=['id'=>'CF0017048','shiftId'=>'shift-3'];
 try { eval($handler); throw new Exception('No response'); }
 catch(Response $response) { if($response->status!==$expected) throw new Exception("Expected $expected, got {$response->status}"); }
 if($expected!==200) {
  foreach($queries as [$sql]) if(str_starts_with($sql,'UPDATE')) throw new Exception('Invalid assignment wrote data');
 } else {
  $updates=array_values(array_filter($queries,fn($q)=>str_starts_with($q[0],'UPDATE bills')));
  if(($updates[0][1]['shiftId']??'')!=='shift-3') throw new Exception('Shift not saved');
  if(str_contains($updates[0][0],'cashier_id=')) throw new Exception('Creator overwritten');
 }
}
runCase('admin',['id'=>'shift-3','store_id'=>'cafe','status'=>'closed'],422);
runCase('admin',['id'=>'shift-3','store_id'=>'restaurant'],422);
runCase('admin',false,422);
runCase('user',['store_id'=>'cafe'],403);
runCase('manager',['store_id'=>'cafe'],403);
echo "PASS: legacy shift reassignment blocked; transfers require audited correction workflow\n";
