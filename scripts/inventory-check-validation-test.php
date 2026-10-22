<?php
require_once __DIR__.'/../public/api/_lib/inventory_check_validation.php';
function fails(array $item): void { try { inventory_check_validate_count($item, true); } catch (InvalidArgumentException $e) { return; } throw new RuntimeException('Expected invalid count'); }
fails(['actualQuantity'=>null]); fails(['actualQuantity'=>'abc']); fails(['actualQuantity'=>-1]);
fails(['actualQuantity'=>2,'systemQuantity'=>3,'note'=>'']);
inventory_check_validate_count(['actualQuantity'=>0,'systemQuantity'=>3,'note'=>'Hao hụt'],true);
inventory_check_validate_count(['actualQuantity'=>null],false);
echo "inventory count validation passed\n";

foreach (['missing_receipt', 'missing_issue'] as $reason) {
    $item = ['actualQuantity'=>120, 'systemQuantity'=>100, 'note'=>'Pending document', 'resolutionType'=>$reason];
    inventory_check_validate_count($item, false);
    fails($item);
    $item['systemQuantity'] = 120;
    fails($item);
}
fails(['actualQuantity'=>120,'systemQuantity'=>100,'note'=>'Pending','resolutionType'=>'invalid']);
$draft = ['items'=>[['productCode'=>'A','actualQuantity'=>120,'note'=>'Variance','resolutionType'=>'missing_receipt']]];
$changed = $draft;
$changed['items'][0]['resolutionType'] = 'adjustment';
if (inventory_checks_same_draft($draft, $changed)) throw new RuntimeException('Approver must not change resolution type');
echo "inventory missing-document validation passed\n";
