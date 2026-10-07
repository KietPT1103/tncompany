<?php
declare(strict_types=1);
// Runs the real endpoint against an isolated SQLite fixture. Only auth/HTTP boundaries
// and MySQL locking syntax are adapted; no application database is contacted.
class FixturePDO extends PDO {
    public function prepare(string $query, array $options = []): PDOStatement|false {
        return parent::prepare(str_replace([' FOR UPDATE','INSERT IGNORE'], ['', 'INSERT OR IGNORE'], $query), $options);
    }
    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false {
        if (str_contains($query, 'information_schema.tables')) $query = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='preparation_receipts'";
        return parent::query($query, $fetchMode ?? PDO::FETCH_ASSOC, ...$fetchModeArgs);
    }
}
if (($argv[1] ?? '') === 'worker') {
    $request = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
    $fixture = new FixturePDO('sqlite:' . $argv[2], null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $fixture->sqliteCreateFunction('NOW', fn() => '2026-10-05 12:00:00');
    function db(): PDO { return $GLOBALS['fixture']; }
    function uuidv4(): string { return bin2hex(random_bytes(16)); }
    function auth_require_permission($permission): array { return ['role'=>$GLOBALS['request']['role'], 'username'=>'fixture-admin']; }
    function field_inventory_require_store(array $user, string $id): string { return $id; }
    function read_json_body(): array { return $GLOBALS['request']['body']; }
    function respond_ok(array $data, int $status=200): never { echo json_encode(['status'=>$status,'data'=>$data]); exit; }
    function respond_error(string $message, int $status): never { echo json_encode(['status'=>$status,'error'=>$message]); exit; }
    require_once __DIR__ . '/../public/api/_lib/inventory_issue_corrections.php';
    require_once __DIR__ . '/../public/api/_lib/inventory_issue_print_jobs.php';
    if (($request['operation'] ?? '') === 'retry') {
        try { respond_ok(inventory_issue_print_jobs_retry('cafe', $request['jobId'])); }
        catch (Throwable $exception) { respond_error($exception->getMessage(), 409); }
    }
    $_SERVER['REQUEST_METHOD'] = $request['method'];
    $_GET = $request['body'];
    $endpoint = ($request['operation'] ?? '') === 'history' ? 'inventory-history.php' : (($request['operation'] ?? '') === 'preparation' ? 'preparation-receipts.php' : 'inventory-issues.php');
    $code = file_get_contents(__DIR__ . '/../public/api/' . $endpoint);
    $code = preg_replace('/^require_once .*;\R/m', '', $code);
    $code = preg_replace('/^(inventory_issues_ensure_schema|inventory_issue_print_jobs_ensure_schema|preparation_receipts_ensure_schema)\(\);\R/m', '', $code);
    if ($endpoint === 'inventory-history.php') {
        $fixture->sqliteCreateCollation('utf8mb4_unicode_ci', fn($left,$right) => strcmp($left,$right));
        $code = preg_replace('/^(products_inventory_ensure_schema|ingredients_ensure_schema)\(\);\R/m', '', $code);
        $code = preg_replace('/^auth_ensure_column.*;\R/m', '', $code);
        $code = preg_replace('/db\(\)->exec\(\'CREATE TABLE IF NOT EXISTS.*?\'\);/s', '', $code);
    }
    eval(substr($code, 5));
    exit;
}
function expect(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException('FAIL: ' . $message);
    echo "PASS $message\n";
}
$path = tempnam(sys_get_temp_dir(), 'issue-fixture-');
$pdo = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE TABLE ingredients (id TEXT PRIMARY KEY,store_id TEXT,ingredient_code TEXT,ingredient_name TEXT,item_kind TEXT,stock_quantity REAL,purchase_to_base_factor REAL,purchase_unit TEXT,unit TEXT,is_active INTEGER,updated_at TEXT,base_unit TEXT,preparation_stock_quantity REAL DEFAULT 0)');
$pdo->exec("INSERT INTO ingredients VALUES ('a','cafe','A','Coffee','ingredient',100,1000,'kg','g',1,NULL,'g',40),('b','cafe','B','Milk','ingredient',20,1,'box','box',1,NULL,'box',10),('f','cafe','F','Fresh','fresh',0,1,'kg','kg',1,NULL,'kg',0)");
$pdo->exec('CREATE TABLE inventory_issues (id TEXT PRIMARY KEY,store_id TEXT,issue_code TEXT,issue_date TEXT,destination TEXT,issued_by TEXT,status TEXT,note TEXT,total_quantity REAL,completed_at TEXT,completed_by TEXT,created_by TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,shift_id TEXT,shift_type TEXT,requires_preparation_receipt INTEGER DEFAULT 0,revision INTEGER DEFAULT 0,cancel_reason TEXT,cancelled_by TEXT,cancelled_at TEXT)');
$pdo->exec('CREATE TABLE inventory_issue_items (id INTEGER PRIMARY KEY AUTOINCREMENT,issue_id TEXT,ingredient_id TEXT,ingredient_code TEXT,ingredient_name TEXT,unit TEXT,quantity REAL,base_quantity REAL,stock_before REAL,stock_after REAL,note TEXT)');
$pdo->exec('CREATE TABLE inventory_issue_print_jobs (id TEXT PRIMARY KEY,store_id TEXT,issue_id TEXT,attempt_number INTEGER,status TEXT DEFAULT "pending",retry_count INTEGER DEFAULT 0,terminal_name TEXT,printed_at TEXT,last_error TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,next_attempt_at TEXT,UNIQUE(issue_id,attempt_number))');
$pdo->exec('CREATE TABLE preparation_receipts (id TEXT PRIMARY KEY,issue_id TEXT,store_id TEXT,receipt_code TEXT,receipt_date TEXT,received_by TEXT,note TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,status TEXT DEFAULT "completed",cancel_reason TEXT,cancelled_at TEXT,cancelled_by TEXT)');
$pdo->exec('CREATE TABLE preparation_receipt_items (id INTEGER PRIMARY KEY AUTOINCREMENT,receipt_id TEXT,ingredient_id TEXT,ingredient_code TEXT,ingredient_name TEXT,unit TEXT,expected_quantity REAL,actual_quantity REAL)');
function call_endpoint(string $method, array $body, string $role='admin', array $extra=[]): array {
    global $path;
    $process = proc_open([PHP_BINARY,__FILE__,'worker',$path], [['pipe','r'],['pipe','w'],['pipe','w']], $pipes);
    fwrite($pipes[0], json_encode(['method'=>$method,'body'=>$body,'role'=>$role]+$extra)); fclose($pipes[0]);
    $out=stream_get_contents($pipes[1]); fclose($pipes[1]); $err=stream_get_contents($pipes[2]); fclose($pipes[2]);
    $exit=proc_close($process);
    if ($exit !== 0) throw new RuntimeException("Worker failed: $err $out");
    return json_decode($out, true, 512, JSON_THROW_ON_ERROR);
}
function stock(string $id): float { global $pdo; return (float)$pdo->query("SELECT stock_quantity FROM ingredients WHERE id='$id'")->fetchColumn(); }
if (($argv[1] ?? '') === '--history-list-only') {
    try {
        $pdo->exec('CREATE TABLE inventory_receipts (id TEXT PRIMARY KEY,store_id TEXT,receipt_code TEXT,receipt_date TEXT,status TEXT,created_at TEXT,order_creator_name TEXT,created_by TEXT,supplier_id TEXT,note TEXT,total_amount REAL)');
        $pdo->exec('CREATE TABLE inventory_receipt_items (id INTEGER PRIMARY KEY,receipt_id TEXT,product_code TEXT,product_name TEXT,unit TEXT,quantity REAL,unit_cost REAL,line_total REAL,note TEXT)');
        $pdo->exec('CREATE TABLE suppliers (id TEXT,supplier_name TEXT)');
        $insert=$pdo->prepare('INSERT INTO inventory_issues (id,store_id,issue_code,issue_date,destination,issued_by,status,total_quantity) VALUES (?,?,?,?,?,?,?,?)');
        for($i=1;$i<=325;$i++) $insert->execute(['history-'.$i,'cafe',sprintf('XK-%04d',$i),'2026-10-08','Bar','Admin','draft',0]);
        $insert->execute(['older','cafe','XK-OLDER','2026-10-07','Bar','Admin','draft',0]);
        $insert->execute(['other','farm','XK-OTHER','2026-10-08','Bar','Admin','draft',0]);
        $query=['storeId'=>'cafe','type'=>'issue','dateFrom'=>'2026-10-08','dateTo'=>'2026-10-08','page'=>1,'limit'=>300];
        $first=call_endpoint('GET',$query,'admin',['operation'=>'history']);
        expect($first['data']['pagination']['total']===325 && count($first['data']['items'])===300,'history counts all matching records beyond old cap');
        $next=call_endpoint('GET',array_replace($query,['page'=>2]),'admin',['operation'=>'history']);
        expect(count($next['data']['items'])===25 && !array_intersect(array_column($first['data']['items'],'id'),array_column($next['data']['items'],'id')),'history next page retains remaining records without duplicates');
        $empty=call_endpoint('GET',array_replace($query,['dateFrom'=>'2026-10-09','dateTo'=>'2026-10-09']),'admin',['operation'=>'history']);
        expect($empty['data']['pagination']['total']===0,'history filters by date and store');
        $receipt=$pdo->prepare('INSERT INTO preparation_receipts (id,issue_id,store_id,receipt_code,receipt_date,received_by,note) VALUES (?,?,?,?,?,?,?)');
        for($i=1;$i<=55;$i++) $receipt->execute(['receive-'.$i,'history-'.$i,'cafe','PC-'.$i,'2026-10-08','Admin','']);
        $receipt->execute(['receive-old','older','cafe','PC-OLD','2026-10-07','Admin','']);
        $list=call_endpoint('GET',['storeId'=>'cafe','dateFrom'=>'2026-10-08','dateTo'=>'2026-10-08'],'admin',['operation'=>'preparation']);
        expect(count($list['data']['history'])===55,'preparation period includes all records beyond old 50 record cap');
        expect(call_endpoint('GET',['storeId'=>'cafe','dateFrom'=>'2026-02-30'],'admin',['operation'=>'preparation'])['status']===422,'preparation rejects invalid dates');
    } finally { $pdo=null; @unlink($path); }
    exit;
}
if (($argv[1] ?? '') === '--list-only') {
    try {
        $insert = $pdo->prepare('INSERT INTO inventory_issues (id,store_id,issue_code,issue_date,destination,issued_by,status,note,total_quantity,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)');
        for ($i=1; $i<=27; $i++) $insert->execute(['list-'.$i,'cafe',sprintf('XK-%03d',$i),'2026-10-08','Bar','Admin','draft','',0,'fixture']);
        $insert->execute(['older','cafe','XK-OLD','2026-10-07','Bar','Admin','draft','',0,'fixture']);
        $insert->execute(['other','farm','XK-OTHER','2026-10-08','Bar','Admin','draft','',0,'fixture']);
        $query=['storeId'=>'cafe','dateFrom'=>'2026-10-08','dateTo'=>'2026-10-08','limit'=>10,'page'=>1];
        $first=call_endpoint('GET',$query);
        expect($first['data']['pagination']['total']===27 && count($first['data']['items'])===10,'date and store filters count only matching bills');
        $second=call_endpoint('GET',array_replace($query,['page'=>2]));
        expect(count($second['data']['items'])===10 && !array_intersect(array_column($first['data']['items'],'id'),array_column($second['data']['items'],'id')),'pages do not repeat bills');
        $last=call_endpoint('GET',array_replace($query,['page'=>99]));
        expect($last['data']['pagination']['page']===3 && count($last['data']['items'])===7,'last page is clamped and preserves remaining bills');
        $large=call_endpoint('GET',array_replace($query,['limit'=>50]));
        expect(count($large['data']['items'])===27 && $large['data']['pagination']['pages']===1,'selected page size is applied');
        $search=call_endpoint('GET',array_replace($query,['keyword'=>'XK-027']));
        expect($search['data']['pagination']['total']===1 && $search['data']['items'][0]['issueCode']==='XK-027','search filters before pagination');
        $empty=call_endpoint('GET',array_replace($query,['dateFrom'=>'2026-10-09','dateTo'=>'2026-10-09']));
        expect($empty['data']['items']===[] && $empty['data']['pagination']['total']===0,'empty date has no bills');
        expect(call_endpoint('GET',array_replace($query,['dateFrom'=>'2026-02-30']))['status']===422,'invalid dates rejected');
        expect(call_endpoint('GET',array_replace($query,['dateFrom'=>'2026-10-09']))['status']===422,'reversed dates rejected');
    } finally { @unlink($path); }
    exit;
}
try {
    $body=['storeId'=>'cafe','issueDate'=>'2026-10-05','destination'=>'Bar','issuedBy'=>'Admin','status'=>'completed','items'=>[['ingredientCode'=>'A','quantity'=>0.03],['ingredientCode'=>'F','quantity'=>2]]];
    $create=call_endpoint('POST',$body);
    expect($create['status']===201 && stock('a')===70.0,'create completed issue deducts converted stock');
    $issue=$create['data']['item']; $body['id']=$issue['id']; $body['revision']=$issue['revision'];
    $body['items']=[['ingredientCode'=>'A','quantity'=>0.04],['ingredientCode'=>'B','quantity'=>5]];
    expect(call_endpoint('POST',$body,'manager')['status']===422 && stock('a')===70.0,'non-admin cannot edit completed issue');
    $edit=call_endpoint('POST',$body);
    expect($edit['status']===200 && stock('a')===60.0 && stock('b')===15.0,'admin correction restores old amount and deducts new items');
    expect(call_endpoint('POST',$body)['status']===422 && stock('a')===60.0,'stale duplicate edit does not deduct again');
    $body['revision']=$edit['data']['item']['revision'];
    $pdo->exec("UPDATE ingredients SET is_active=0 WHERE id='a'");
    $metadata=$body; $metadata['note']='Correct note';
    $metadataEdit=call_endpoint('POST',$metadata);
    expect($metadataEdit['status']===200 && stock('a')===60.0, 'inactive original ingredient remains editable');
    $body['revision']=$metadataEdit['data']['item']['revision'];
    $pdo->exec("UPDATE ingredients SET is_active=1 WHERE id='a'");
    $excess=$body; $excess['items'][1]['quantity']=99;
    expect(call_endpoint('POST',$excess)['status']===422 && stock('a')===60.0 && stock('b')===15.0,'insufficient stock rolls back entire endpoint transaction');
    expect(call_endpoint('DELETE',['storeId'=>'cafe','id'=>$body['id']])['status']===405,'physical deletion is unavailable');
    $cancel=['action'=>'cancel','storeId'=>'cafe','id'=>$body['id'],'revision'=>$body['revision'],'reason'=>'  '];
    expect(call_endpoint('POST',$cancel)['status']===409 && stock('a')===60.0,'blank cancellation reason rejected');
    $cancel['reason']='Nhập sai số lượng';
    expect(call_endpoint('POST',$cancel,'user')['status']===403,'non-admin cannot cancel');
    $pdo->prepare('INSERT INTO preparation_receipts(id,issue_id) VALUES (?,?)')->execute(['received',$body['id']]);
    expect(call_endpoint('POST',$cancel)['status']===409 && stock('a')===60.0,'received preparation issue cannot be cancelled independently');
    $pdo->exec("DELETE FROM preparation_receipts WHERE id='received'");
    $cancelled=call_endpoint('POST',$cancel);
    expect($cancelled['status']===200 && stock('a')===100.0 && stock('b')===20.0,'cancel restores all stock');
    expect($cancelled['data']['item']['status']==='cancelled' && $cancelled['data']['item']['cancelReason']==='Nhập sai số lượng' && count($cancelled['data']['item']['items'])===2,'cancel preserves document, items and reason');
    $cancel['revision']=$cancelled['data']['item']['revision'];
    expect(call_endpoint('POST',$cancel)['status']===409 && stock('a')===100.0,'repeat cancellation never restores twice');
    expect(call_endpoint('POST',$body)['status']===422 && stock('a')===100.0,'cancelled issue cannot be edited');
    expect($pdo->query('SELECT status FROM inventory_issue_print_jobs')->fetchColumn()==='cancelled','cancel stops pending print job');
    $jobId=$pdo->query('SELECT id FROM inventory_issue_print_jobs')->fetchColumn();
    expect(call_endpoint('POST',[],'admin',['operation'=>'retry','jobId'=>$jobId])['status']===409,'cancelled issue cannot be requeued for printing');
    $body2=['storeId'=>'cafe','issueDate'=>'2026-10-05','destination'=>'Bar','issuedBy'=>'Cashier','status'=>'completed','items'=>[['ingredientCode'=>'A','quantity'=>0.02],['ingredientCode'=>'B','quantity'=>3]]];
    $issue2=call_endpoint('POST',$body2)['data']['item'];
    $receive=['storeId'=>'cafe','issueId'=>$issue2['id'],'receivedBy'=>'Bar','items'=>[['ingredientId'=>'a','actualQuantity'=>18],['ingredientId'=>'b','actualQuantity'=>2]]];
    $result=call_endpoint('POST',$receive,'admin',['operation'=>'preparation']);
    expect($result['status']===201,'preparation receipt confirmed');
    $receiptId=$result['data']['id'];
    $cancelReceipt=['storeId'=>'cafe','id'=>$receiptId,'action'=>'cancel','reason'=>'Sai số thực nhận'];
    expect(call_endpoint('POST',$cancelReceipt,'user',['operation'=>'preparation'])['status']===403,'only admin can cancel preparation receipt');
    $empty=$cancelReceipt; $empty['reason']=' ';
    expect(call_endpoint('POST',$empty,'admin',['operation'=>'preparation'])['status']===422,'preparation cancellation requires reason');
    $cancelResult=call_endpoint('POST',$cancelReceipt,'admin',['operation'=>'preparation']);
    expect($cancelResult['status']===200,'preparation receipt cancelled');
    expect((float)$pdo->query("SELECT preparation_stock_quantity FROM ingredients WHERE id='a'")->fetchColumn()===40.0 && (float)$pdo->query("SELECT preparation_stock_quantity FROM ingredients WHERE id='b'")->fetchColumn()===10.0,'cancel subtracts actual received stock');
    expect(stock('a')===80.0 && stock('b')===17.0,'preparation cancellation leaves cashier stock unchanged');
    $updated=array_values(array_filter(call_endpoint('GET',['storeId'=>'cafe'])['data']['items'], fn($item) => $item['id'] === $issue2['id']))[0];
    $pending=call_endpoint('GET',['storeId'=>'cafe'],'admin',['operation'=>'preparation']);
    expect(count($pending['data']['pending'])===1 && $pending['data']['pending'][0]['issueId']===$issue2['id'],'same issue returns to pending');
    expect($pending['data']['history'][0]['status']==='cancelled' && $pending['data']['history'][0]['cancelReason']==='Sai số thực nhận','cancelled preparation history retained');
    expect(call_endpoint('POST',$cancelReceipt,'admin',['operation'=>'preparation'])['status']===409,'repeat preparation cancellation rejected');
    $body2['id']=$issue2['id']; $body2['revision']=$updated['revision']; $body2['items'][0]['quantity']=0.025;
    expect(call_endpoint('POST',$body2)['status']===200 && stock('a')===75.0,'cashier can correct issue after receipt cancellation');
    $receive['items'][0]['actualQuantity']=24; $receive['items'][1]['actualQuantity']=3;
    $second=call_endpoint('POST',$receive,'admin',['operation'=>'preparation']);
    expect($second['status']===201 && $second['data']['id']!==$receiptId,'same issue accepts a new receipt preserving cancelled receipt');
    expect((float)$pdo->query("SELECT preparation_stock_quantity FROM ingredients WHERE id='a'")->fetchColumn()===64.0,'re-receive adds only new actual quantity');
    $pdo->exec("UPDATE ingredients SET preparation_stock_quantity=0 WHERE id='b'");
    $cancelReceipt['id']=$second['data']['id'];
    expect(call_endpoint('POST',$cancelReceipt,'admin',['operation'=>'preparation'])['status']===409,'cancellation blocked if received stock has been consumed');
    expect((float)$pdo->query("SELECT preparation_stock_quantity FROM ingredients WHERE id='a'")->fetchColumn()===64.0,'insufficient preparation stock rolls back all lines');
} finally { $pdo=null; unlink($path); }