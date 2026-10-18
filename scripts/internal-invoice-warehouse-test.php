<?php
require __DIR__ . '/../public/api/_lib/internal_invoice_warehouse.php';
function check($value, $message) { if (!$value) throw new RuntimeException($message); }
check(internal_invoice_category_key('  Gỗ   xẻ ') === internal_invoice_category_key('Gỗ xẻ'), 'normalize spaces');
$numbers = [];
for ($i=0; $i<1000; $i++) $numbers[] = internal_invoice_number();
check(count(array_unique($numbers)) === 1000, 'unique invoice numbers');
check(str_starts_with($numbers[0], 'NB-'), 'internal prefix');
$valid = internal_invoice_validate_rows([['name'=>'','quantity'=>1], ['name'=>'Wood','quantity'=>2,'unitPrice'=>3,'categoryName'=>'Gỗ']]);
check(count($valid) === 1 && $valid[0]['categoryName'] === 'Gỗ', 'skip empty, preserve category');
foreach ([['name'=>'Wood','quantity'=>0,'unitPrice'=>3], ['name'=>'','quantity'=>2,'unitPrice'=>3], ['name'=>'Wood','quantity'=>1,'unitPrice'=>-1]] as $row) {
    try { internal_invoice_validate_rows([$row]); throw new RuntimeException('accepted invalid row'); }
    catch (InvalidArgumentException $e) { check(str_contains($e->getMessage(), '1'), 'row number'); }
}
echo "PASS internal invoice validation, category normalization, numbering
";
