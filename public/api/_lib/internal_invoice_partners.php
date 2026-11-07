<?php
declare(strict_types=1);
function internal_invoice_partners(string $search): array {
    $where="invoice_scope='internal' AND partner_name IS NOT NULL AND TRIM(partner_name)<>''";$params=[];
    if(trim($search)!==''){$where.=' AND '.invoice_search_expression('partner_name').' LIKE ?';$params[]=invoice_search_value($search);}
    $s=db()->prepare('SELECT TRIM(partner_name) name FROM invoice_entries WHERE '.$where.' GROUP BY TRIM(partner_name) ORDER BY MAX(updated_at) DESC,name LIMIT 30');
    $s->execute($params);return array_column($s->fetchAll(),'name');
}
