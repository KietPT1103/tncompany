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
// A short link has its own revocation version and never exposes the shared code.
check_access(function_exists('revenue_access_generate_link'), 'Short link generation must exist');
$codeToken = revenue_access_unlock($p, $custom, 'code-reader', 3000);
$link = revenue_access_generate_link($p);
check_access((bool)preg_match('/^[A-Za-z0-9_-]{16}$/D', $link), 'Link has 96 random bits in 16 URL-safe characters');
$linkRow = $p->query('SELECT * FROM revenue_access_links')->fetch();
check_access($linkRow['link_hash'] === hash('sha256', $link), 'Only the digest of the share link is stored');
$linkToken = revenue_access_unlock_link($p, $link, 'link-reader', 3000);
check_access(revenue_access_valid($p, $linkToken), 'Link opens reports without entering a code');
check_access($linkToken !== $link && strlen($linkToken) === 64, 'Link is exchanged for a separate browser token');
check_access(!revenue_access_valid($p, $link), 'Raw link is not an API bearer credential');
$nextLink = revenue_access_generate_link($p);
check_access($nextLink !== $link && !revenue_access_valid($p, $linkToken), 'Link rotation revokes old link sessions');
check_access(revenue_access_valid($p, $codeToken), 'Link rotation preserves code sessions');
try { revenue_access_unlock_link($p, $link, 'old-link', 3000); throw new Exception('Old link accepted'); }
catch (RuntimeException $e) { check_access($e->getCode() === 403, 'Old link denied'); }
foreach (['', str_repeat('x', 15), str_repeat('x', 17), '../invalid/link!', str_repeat('x', 16)] as $badLink) {
    try { revenue_access_unlock_link($p, $badLink, 'bad-link', 3000); throw new Exception('Invalid link accepted'); }
    catch (RuntimeException $e) { check_access($e->getCode() === 403, 'Invalid link denied'); }
}
$nextToken = revenue_access_unlock_link($p, $nextLink, 'new-link', 3000);
revenue_access_generate($p, 'Replacement-123');
check_access(!revenue_access_valid($p, $nextToken) && !revenue_access_valid($p, $codeToken), 'Code rotation revokes code and link sessions');
try { revenue_access_unlock_link($p, $nextLink, 'revoked-link', 3000); throw new Exception('Link survived code rotation'); }
catch (RuntimeException $e) { check_access($e->getCode() === 403, 'Code rotation revokes the link'); }
$fresh = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$firstLink = revenue_access_generate_link($fresh);
check_access(revenue_access_valid($fresh, revenue_access_unlock_link($fresh, $firstLink, 'first-reader', 3000)), 'Link works before any shared code exists');
for ($i = 0; $i < 10; $i++) {
    try { revenue_access_unlock_link($fresh, str_repeat('x', 16), 'link-attacker', 3000); }
    catch (RuntimeException $e) { check_access($e->getCode() === 403, 'First ten link attempts checked'); }
}
try { revenue_access_unlock_link($fresh, $firstLink, 'link-attacker', 3000); throw new Exception('Link throttle bypassed'); }
catch (RuntimeException $e) { check_access($e->getCode() === 429, 'Link guessing is rate limited'); }
check_access(revenue_access_valid($fresh, revenue_access_unlock_link($fresh, $firstLink, 'link-attacker', 4000)), 'Link throttle resets');
echo "Revenue access: PASS\n";
