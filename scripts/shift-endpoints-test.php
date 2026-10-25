<?php
declare(strict_types=1);
require __DIR__.'/shift-management-test.php';
class ShiftTestResponse extends RuntimeException {
    public function __construct(public int $status, public array $data=[]) { parent::__construct('Response '.$status); }
}
function respond_error($message,$status=400,$extra=[]) { throw new ShiftTestResponse($status,['error'=>$message]); }
function respond_ok($data=[],$status=200) { throw new ShiftTestResponse($status,$data); }
function realtime_publish(...$args) {}
function pos_assert_record_store(...$args) {}
function pos_mysql_datetime($value) { return date('Y-m-d H:i:s',strtotime($value)); }
function pos_shift_payload($row) { return $row; }
function uuidv4() { return 'opened-test'; }
class ShiftLockStatement {
    public function execute($params) {}
    public function fetchColumn() { return 1; }
}
class ShiftOpenDatabase {
    public function __construct(private PDO $pdo) {}
    public function prepare($sql) {
        if (str_contains($sql,'GET_LOCK') || str_contains($sql,'RELEASE_LOCK')) return new ShiftLockStatement();
        return $this->pdo->prepare($sql);
    }
}
$openDatabase=null;
function db() { global $pdo,$openDatabase; return $openDatabase ?? $pdo; }
$source=file_get_contents(__DIR__.'/../public/api/pos.php');
function handler(string $start,string $end):string { global $source; $offset=strpos($source,$start); return substr($source,$offset,strpos($source,$end,$offset)-$offset); }
$writeGuard=handler('function pos_validate_shift_for_write(',"if (\$method === 'GET' && \$resource === 'tables')");
eval($writeGuard);
function endpoint(string $handler,array $input,int $expected):array {
    $user=['id'=>'cashier5','role'=>'user']; $body=$input; $posStoreId='cafe'; $method='PATCH'; $resource='shifts';
    if (str_contains($handler,"\$method === 'POST'")) $method='POST';
    try { eval($handler); } catch(ShiftTestResponse $response) { check($response->status===$expected, 'Expected '.$expected.' got '.$response->status.': '.json_encode($response->data)); return $response->data; }
    throw new RuntimeException('No response');
}
$pdo->exec('ALTER TABLE cashier_shifts ADD COLUMN close_note TEXT');
$pdo->exec("INSERT INTO cashier_shifts (id,store_id,cashier_uid,status,opened_at,opening_cash) VALUES ('close-test','cafe','cashier5','open','2026-10-22 12:55:00',100)");
$closeHandler=handler("if (\$method === 'PATCH' && \$resource === 'shifts') {","if (\$method === 'GET' && \$resource === 'live-orders')");
$summary=['cashSales'=>0,'transferSales'=>0,'totalSales'=>0,'completedBills'=>0,'cancelledBills'=>0,'cancelledAmount'=>0,'incomeVouchers'=>0,'expenseVouchers'=>0,'netCashFlow'=>0,'expectedClosingCash'=>100];
$close=['id'=>'close-test','closingCash'=>100,'summary'=>$summary,'expectedOpenedAt'=>'2026-10-22T05:55:00Z'];
$pdo->exec("INSERT INTO bills VALUES ('new-sale','cafe','close-test','cashier5','T01',50,'completed','cash','2026-10-22 14:00:00')");
endpoint($closeHandler,$close,409);
check($pdo->query("SELECT status FROM cashier_shifts WHERE id='close-test'")->fetchColumn()==='open','Stale preview closed shift');
$close['summary']=array_replace($summary,['cashSales'=>50,'totalSales'=>50,'completedBills'=>1,'netCashFlow'=>50,'expectedClosingCash'=>150]);
endpoint($closeHandler,$close,200);
$closed=$pdo->query("SELECT * FROM cashier_shifts WHERE id='close-test'")->fetch();
check($closed['status']==='closed' && (float)$closed['cash_sales']===50.0 && (float)$closed['closing_cash']===100.0,'Close totals wrong');
endpoint($closeHandler,$close,409);
try { pos_validate_shift_for_write(['shiftId'=>'wrong'],['id'=>'cashier2','role'=>'user'],'cafe'); throw new RuntimeException('Closed shift accepted'); }
catch(ShiftTestResponse $r) { check($r->status===409,'Closed guard status'); }
try { pos_validate_shift_for_write([],['id'=>'cashier2','role'=>'user'],'cafe'); throw new RuntimeException('Missing shift accepted'); }
catch(ShiftTestResponse $r) { check($r->status===409,'Missing guard status'); }
$pdo->exec('ALTER TABLE cashier_shifts ADD COLUMN open_note TEXT');
$pdo->exec('ALTER TABLE cashier_shifts ADD COLUMN opened_by_device_id TEXT');
$pdo->exec('ALTER TABLE cashier_shifts ADD COLUMN opened_by_device_name TEXT');
$insert=$pdo->prepare("INSERT INTO cashier_shifts (id,store_id,cashier_uid,shift_type,status,opened_at,closed_at) VALUES ('previous','cafe','cashier5','shift_2','closed',?,?)");
$insert->execute([date('Y-m-d 08:00:00'),date('Y-m-d 12:00:00')]);
$openDatabase=new ShiftOpenDatabase($pdo);
$openHandler=handler("if (\$method === 'POST' && \$resource === 'shifts') {","if (\$method === 'PATCH' && \$resource === 'shifts') {");
$open=['storeId'=>'cafe','cashierUid'=>'cashier5','cashierName'=>'Cashier5','shiftType'=>'shift_2','deviceId'=>'device','openingCash'=>100];
endpoint($openHandler,$open,409);
check((int)$pdo->query("SELECT COUNT(*) FROM cashier_shifts WHERE id='opened-test'")->fetchColumn()===0,'Unconfirmed reopening inserted shift');
endpoint($openHandler,$open+['confirmReopen'=>true],201);
$result=endpoint($openHandler,$open,200);
check($result['alreadyOpen']===true,'Existing open shift was duplicated');
echo "PASS: close endpoint rejects stale preview, recomputes totals; write guard; confirmed reopen; shared open shift\n";
