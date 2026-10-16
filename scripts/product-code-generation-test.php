<?php
declare(strict_types=1);
require_once __DIR__ . '/../public/api/_lib/product_code_generation.php';
$cases = [''=>'SP000001','SP1'=>'SP000002','SP000142'=>'SP000143','sp009999'=>'SP010000','SP999999'=>'SP1000000'];
foreach ($cases as $current=>$expected) {
    if (products_increment_sp_code($current) !== $expected) throw new RuntimeException('Unexpected next code for '.$current);
}
echo "PASS product code sequence formatting and rollover\n";
