<?php
require __DIR__.'/../public/api/_lib/revenue_access.php';
function check_access(bool $value,string $message):void {if(!$value)throw new RuntimeException($message);}
$p=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
revenue_access_schema($p);
check_access(!revenue_access_valid($p,''),'No code or token means locked');
try {revenue_access_unlock($p,'anything','client',1000);throw new Exception('Missing config unlocked');} catch (RuntimeException $e) {check_access($e->getCode()===503,'Missing config must fail closed');}
$code=revenue_access_generate($p);
check_access((bool)preg_match('/^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/',$code),'Generated code has 64 random bits');
try {revenue_access_unlock($p,'wrong','client',1000);throw new Exception('Wrong code unlocked');} catch (RuntimeException $e) {check_access($e->getCode()===403,'Wrong code denied');}
$token=revenue_access_unlock($p,$code,'client',1000);
check_access(revenue_access_valid($p,$token),'Correct code opens without an account');
check_access(!revenue_access_valid($p,'admin-token'),'Account token cannot bypass code');
check_access(!revenue_access_valid($p,str_repeat('0',64)),'Forged token denied');
$row=$p->query('SELECT * FROM revenue_access_tokens')->fetch();
check_access($row['token_hash']!==$token,'Do not store bearer token in plaintext');
check_access(revenue_access_valid($p,$token),'No time expiry for remembered token');
$newCode=revenue_access_generate($p);
check_access($code!==$newCode&&!revenue_access_valid($p,$token),'Rotation invalidates previously remembered tokens');
try {revenue_access_unlock($p,$code,'client',1000);throw new Exception('Old code unlocked');} catch(RuntimeException $e){check_access($e->getCode()===403,'Old code denied');}
for($i=0;$i<10;$i++){try {revenue_access_unlock($p,'bad','attacker',1000);}catch(RuntimeException $e){check_access($e->getCode()===403,'First ten attempts checked');}}
try {revenue_access_unlock($p,$newCode,'attacker',1000);throw new Exception('Throttle bypassed');}catch(RuntimeException $e){check_access($e->getCode()===429,'Repeated guesses rate limited');}
check_access(revenue_access_valid($p,revenue_access_unlock($p,$newCode,'attacker',2000)),'Throttle resets after window');
$custom='MaRieng-123';
check_access(revenue_access_generate($p,$custom)===$custom,'Admin can set a custom code');
check_access(revenue_access_valid($p,revenue_access_unlock($p,$custom,'custom-client',2000)),'Custom code opens report');
try {revenue_access_generate($p,'123');throw new Exception('Short code accepted');}catch(InvalidArgumentException $e){}
echo "Revenue access: PASS\n";
