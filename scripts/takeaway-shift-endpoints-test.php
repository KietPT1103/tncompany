<?php
declare(strict_types=1);
require __DIR__.'/takeaway-business-shifts-test.php';
class EndpointResult extends RuntimeException {
    public function __construct(public int $status,public array $data) {}
}
function db(): PDO { global $p; return $p; }
function respond_ok(array $data,int $status=200): never { throw new EndpointResult($status,$data); }
function respond_error(string $message,int $status=400): never { throw new EndpointResult($status,['error'=>$message]); }
function realtime_publish(...$args): void {}
function pos_assert_record_store(string $table,string $id,array $user,string $store): void { takeaway_shift_row(db(),$store,$id); }
function pos_mysql_datetime(string $value): string { return date('Y-m-d H:i:s',strtotime($value)); }
function pos_timestamp(?string $value): ?array { return $value ? ['seconds'=>strtotime($value)] : null; }
function stores_find(PDO $p,string $id): array { return ['id'=>$id,'isTakeAway'=>true,'takeawayShiftEnabled'=>true]; }
$source=file_get_contents(__DIR__.'/../public/api/pos.php');
function extract_handler(string $start,string $end): string {
    global $source;
    $offset=strpos($source,$start);
    return substr($source,$offset,strpos($source,$end,$offset)-$offset);
}
eval(extract_handler('function pos_shift_payload(', 'function pos_remember_voucher_category('));
$openHandler=extract_handler("if (\$method === 'POST' && \$resource === 'shifts') {","if (\$method === 'PATCH' && \$resource === 'shifts') {");
$closeHandler=extract_handler("if (\$method === 'PATCH' && \$resource === 'shifts') {","if (\$method === 'GET' && \$resource === 'live-orders') {");
function call_handler(string $handler,string $method,array $body,array $user,int $status): array {
    $resource='shifts';$posStoreId='cart';
    try { eval($handler); } catch (EndpointResult $response) {
        check($response->status===$status,'Expected '.$status.' got '.$response->status.' '.json_encode($response->data));
        return $response->data;
    }
    throw new RuntimeException('Endpoint did not respond');
}
$user=['id'=>'u1','role'=>'user'];
$opened=call_handler($openHandler,'POST',['cashierUid'=>'u4','openingCash'=>100,'deviceId'=>'d','shiftType'=>'shift_3'],$user,200);
check($opened['item']['shiftNumber']===1,'POST derives slot from authenticated account, ignoring supplied cashier and type');
check($opened['item']['businessCycleId']!==null && !$opened['item']['isPreviousDay'],'Payload carries cycle-aware overnight state');
$id=$opened['item']['id'];
$body=['id'=>$id,'closingCash'=>100,'summary'=>takeaway_shift_summary(takeaway_shift_row($p,'cart',$id))];
call_handler($closeHandler,'PATCH',$body,['id'=>'u2','role'=>'user'],403);
$closed=call_handler($closeHandler,'PATCH',$body,$user,200);
check($closed['report']['shiftNumber']===1,'Normal close endpoint returns persisted printable report');
check(call_handler($closeHandler,'PATCH',$body,$user,200)['idempotent'],'Endpoint replay does not close twice');
$p->exec("INSERT INTO user_takeaway_shifts VALUES('replacement','cart',1)");
$_GET=['checkReopen'=>'1'];
$getHandler=extract_handler("if (\$method === 'GET' && \$resource === 'shifts') {","if (\$method === 'POST' && \$resource === 'shifts') {");
$warning=call_handler($getHandler,'GET',[],['id'=>'replacement','role'=>'user'],200);
check($warning['item']['id']===$id,'Replacement account can confirm reopening an assigned slot closed by another account');
$_GET=[];
echo "PASS takeaway POS endpoints: authenticated slot, cycle payload, close ownership and retry\n";
