<?php
require __DIR__.'/../public/api/_lib/internal_invoice_warehouse.php';
require __DIR__.'/../public/api/_lib/internal_invoice_import.php';
function check($ok,$message){if(!$ok)throw new RuntimeException($message);}
$incoming=['invoiceDate'=>'2026-10-12','items'=>[['name'=>'Sắt','quantity'=>4,'unit'=>'cây','unitPrice'=>100,'categoryName'=>'Sắt - Thép']]];
$old=['id'=>'old','invoiceDate'=>'2026-10-12','note'=>'Import Excel sheet: Old | Dong: 99 | Nhom: wrong','items'=>[['id'=>1,'name'=>'Sắt','quantity'=>4,'unit'=>'cây','unitPrice'=>100,'categoryName'=>'']]];
check(internal_import_classify($incoming,[])['status']==='new','new');
check(internal_import_classify($incoming,[$old])['status']==='category','category only ignores source row');
$old['items'][0]['categoryName']='Sắt - Thép';
check(internal_import_classify($incoming,[$old])['status']==='existing','exact ignores old notes');
$incoming['items'][0]['quantity']=6;
check(internal_import_classify($incoming,[$old])['status']==='changed','quantity changed');
check(internal_import_classify($incoming,[$old,$old])['status']==='ambiguous','ambiguous never auto-updates');
$incoming['items'][0]['quantity']=4;
$incoming['items'][0]['categoryName']='';
check(internal_import_classify($incoming,[$old])['status']==='existing','blank category must not clear existing');
check(internal_import_classify($incoming,[$old,$old])['status']==='ambiguous','identical purchases need review');
echo "PASS internal import reconciliation and conservative matching\n";

$oldRows=[['name'=>'Sắt','quantity'=>2,'unit'=>'cây','unitPrice'=>100,'categoryId'=>1,'categoryName'=>'A'],['name'=>'Sắt','quantity'=>3,'unit'=>'cây','unitPrice'=>100,'categoryId'=>2,'categoryName'=>'B']];
$blankRows=array_map(function($item){$item['categoryName']='';unset($item['categoryId']);return $item;},array_reverse($oldRows));
$kept=internal_import_preserve_categories($blankRows,$oldRows);
check($kept[0]['categoryId']===2 && $kept[1]['categoryId']===1,'consume exact financial matches across reordered rows');
$blankRows[0]['quantity']=6;$blankRows[1]['quantity']=7;
try{internal_import_preserve_categories($blankRows,$oldRows);throw new RuntimeException('ambiguous categories accepted');}catch(InvalidArgumentException $e){}
echo "PASS one-to-one category preservation and ambiguous identity guard\n";

$duplicateOld=$oldRows;$duplicateOld[1]['quantity']=2;
$partial=$duplicateOld;$partial[0]['categoryName']='';unset($partial[0]['categoryId']);$partial[1]['categoryName']='C';
try{internal_import_preserve_categories($partial,$duplicateOld);throw new RuntimeException('ambiguous partial recategorization accepted');}catch(InvalidArgumentException $e){}
