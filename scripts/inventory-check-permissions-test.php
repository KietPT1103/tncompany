<?php
declare(strict_types=1);
$source=file_get_contents(__DIR__.'/../public/api/_lib/auth.php');
$start=strpos($source,'function auth_normalize_role(');$end=strpos($source,'function auth_map_user(', $start);eval(substr($source,$start,$end-$start));
$start=strpos($source,'function auth_has_permission(');$end=strpos($source,'function auth_require_permission(', $start);eval(substr($source,$start,$end-$start));
require_once __DIR__.'/../public/api/_lib/inventory_check_validation.php';
function check(bool $ok,string $message):void {if(!$ok)throw new RuntimeException($message);}
check(inventory_checks_required_actions('', 'draft')===['inventory_checks.create'],'new draft needs create');
check(inventory_checks_required_actions('id', 'draft')===['inventory_checks.update'],'draft edit needs update');
check(inventory_checks_required_actions('id', 'completed')===['inventory_checks.complete'],'existing completion needs complete');
check(inventory_checks_required_actions('', 'completed')===['inventory_checks.create','inventory_checks.complete'],'direct completion needs create AND complete');
$viewer=['role'=>'user','permissions'=>['inventory_checks.access']];
foreach(['create','update','complete','delete'] as $action)check(!auth_has_permission($viewer,'inventory_checks.'.$action),'legacy access is view only');
foreach(['access','create','update','complete','delete'] as $action)check(auth_has_permission(['role'=>'admin'],'inventory_checks.'.$action),'admin action registered');
foreach(['create','update','complete','delete'] as $action){
 $effective=auth_effective_permissions(['role'=>'user','permissions_json'=>json_encode(['inventory_checks.'.$action])]);
 check(in_array('inventory_checks.access',$effective,true),'action grants read access');
 foreach(['create','update','complete','delete'] as $other)check(in_array('inventory_checks.'.$other,$effective,true)===($action===$other),'no sibling action inheritance');
 check(!in_array('bills.access',$effective,true),'no POS permission inheritance');
}
inventory_checks_require_draft('draft');
foreach(['completed','cancelled'] as $status){
 try{inventory_checks_require_draft($status);throw new LogicException('Non-draft mutation allowed');}catch(InvalidArgumentException $e){}
}
$saved=['checkDate'=>'2026-10-21','note'=>'Count','items'=>[['productCode'=>'NL1','actualQuantity'=>3,'note'=>'Missing']]];
check(inventory_checks_same_draft($saved,$saved),'unchanged draft can be approved');
$changed=$saved;$changed['items'][0]['actualQuantity']=4;check(!inventory_checks_same_draft($saved,$changed),'approver cannot change count');
$changed=$saved;$changed['items'][0]['note']='Other';check(!inventory_checks_same_draft($saved,$changed),'approver cannot change reason');
$changed=$saved;$changed['items']=[];check(!inventory_checks_same_draft($saved,$changed),'approver cannot remove items');
echo "PASS inventory check permissions: explicit actions, legacy read-only, admin, approval payload protection\n";
