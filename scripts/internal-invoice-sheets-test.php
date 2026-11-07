<?php
declare(strict_types=1);
require __DIR__.'/../public/api/_lib/internal_invoice_sheets.php';
function verify($value,string $message): void { if (!$value) throw new RuntimeException($message); }
function csvRows(array $rows): string { $f=fopen('php://temp','r+'); foreach($rows as $row)fputcsv($f,$row); rewind($f);return stream_get_contents($f); }
$headers=['Ngày nhập','Loại vật tư','Số lượng','Đơn vị','Nguồn cung','Đơn giá','Thành tiền','Link bill'];
$url='https://drive.google.com/file/d/abc123/view?usp=sharing';
$rows=[ $headers,['02/11/2026','Gỗ','1,5','khối','Chiêu Thuỷ','1.200.000','',' '.$url.' '],['02/11/2026','Đinh','2','kg','Chiêu Thuỷ','20.000','','https://drive.google.com/open?id=abc123'] ];
$parsed=internal_sheets_parse(['Tuần 1'=>csvRows($rows)]);
verify(count($parsed['bills'])===1 && count($parsed['bills'][0]['items'])===2,'same day and normalized Drive link group');
verify($parsed['bills'][0]['items'][0]['quantity']===1.5 && $parsed['bills'][0]['items'][0]['unitPrice']===1200000.0,'Vietnamese quantities and prices');
verify($parsed['bills'][0]['invoiceDate']==='2026-11-02','Vietnamese date');
$next=$rows; $next[1][0]='03/11/2026';unset($next[2]);
verify(count(internal_sheets_parse(['one'=>csvRows($rows),'two'=>csvRows(array_values($next))])['bills'])===2,'separate days');
$next=$rows; $next[1][5]='';
$invalid=internal_sheets_parse(['one'=>csvRows($next)]);
verify(count($invalid['bills'])===0 && count($invalid['errors'])>0,'missing price blocks whole bill');
$next=$rows;$next[2][4]='Other';
verify(count(internal_sheets_parse(['one'=>csvRows($next)])['bills'])===0,'conflicting sellers blocked');
$next=$rows;$next[1][7]='javascript:alert(1)';$next[2][7]='';
verify(count(internal_sheets_parse(['one'=>csvRows($next)])['bills'])===0,'unsafe and missing links skipped');
$next=$rows;$next[1][7]='';
verify(count(internal_sheets_parse(['one'=>csvRows($next)])['bills'])===0,'missing link does not shrink another bill on same day');
$next=$rows;$next[1][0]='31/02/2026';
verify(count(internal_sheets_parse(['one'=>csvRows($next)])['bills'])===0,'invalid date quarantines same-link group');
verify(internal_sheets_bill_url('https://example.com/bill.jpg?sig=secret')==='https://example.com/bill.jpg?sig=secret','preserve signed URLs');
verify(internal_sheets_bill_url('https://drive.google.com/drive/folders/folder123?usp=sharing')===internal_sheets_bill_url('https://drive.google.com/drive/folders/folder123'),'folder share parameters do not duplicate bills');
$tiny=$rows;$tiny[1][2]='0,0001';
verify(!internal_sheets_parse(['one'=>csvRows($tiny)])['bills'],'subprecision quantity blocks bill before API persistence');
$tiny=$rows;$tiny[1][5]='0,001';
verify(!internal_sheets_parse(['one'=>csvRows($tiny)])['bills'],'subprecision price blocks bill before API persistence');
$shuffled=[$headers,['2026-11-02','Gỗ','3','khối','A','1234.50','',$url]];
verify(internal_sheets_parse(['one'=>csvRows($shuffled)])['bills'][0]['items'][0]['unitPrice']===1234.5,'unformatted decimals');
$extra=[['Ngày nhập','Loại vật tư','Nguồn cung','Số lượng','Đơn vị','Đơn giá','Phát sinh','Thành tiền','Link bill'],['02/11/2026','Gỗ','A','3','khối','100','50','350',$url]];
$extraBill=internal_sheets_parse(['one'=>csvRows($extra)])['bills'][0];
verify(count($extraBill['items'])===2 && $extraBill['items'][1]['unitPrice']===50.0 && $extraBill['items'][1]['quantity']===1.0 && $extraBill['items'][1]['categoryName']==='Chi phí phát sinh','extra cost creates its own expense line');
$extra[1][6]='0';
verify(count(internal_sheets_parse(['one'=>csvRows($extra)])['bills'])===1,'column order and zero extra cost accepted');
echo "PASS sheet parsing, grouping, dates, prices and incomplete bill guards\n";
