<?php
require_once __DIR__.'/../public/api/_lib/inventory_check_validation.php';
function fails(array $item): void { try { inventory_check_validate_count($item, true); } catch (InvalidArgumentException $e) { return; } throw new RuntimeException('Expected invalid count'); }
fails(['actualQuantity'=>null]); fails(['actualQuantity'=>'abc']); fails(['actualQuantity'=>-1]);
fails(['actualQuantity'=>2,'systemQuantity'=>3,'note'=>'']);
inventory_check_validate_count(['actualQuantity'=>0,'systemQuantity'=>3,'note'=>'Hao hụt'],true);
inventory_check_validate_count(['actualQuantity'=>null],false);
echo "inventory count validation passed\n";
