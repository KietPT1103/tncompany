<?php
declare(strict_types=1);
require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/internal_invoice_warehouse.php';
$user = auth_require_permission('internal_invoices.access');
internal_invoice_ensure_schema();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    try {
        $id = internal_invoice_category((string)($body['name'] ?? ''));
        if (!$id) respond_error('Nhập tên loại hàng.', 422);
        $stmt = db()->prepare('SELECT id,name FROM internal_invoice_categories WHERE id=?');
        $stmt->execute([$id]);
        respond_ok(['item'=>$stmt->fetch()]);
    } catch (InvalidArgumentException $e) { respond_error($e->getMessage(), 422); }
}
if ($method !== 'GET') respond_error('Method not allowed', 405);
$categories = db()->query('SELECT id,name FROM internal_invoice_categories ORDER BY name')->fetchAll();
$search = trim((string)($_GET['search'] ?? ''));
$category = trim((string)($_GET['categoryId'] ?? ''));
$where = "e.invoice_scope='internal'";
$params = [];
if ($search !== '') {
    $where .= ' AND i.item_name LIKE ?';
    $params[] = '%' . $search . '%';
}
if ($category === 'uncategorized') $where .= ' AND i.internal_category_id IS NULL';
elseif ($category !== '') { $where .= ' AND i.internal_category_id=?'; $params[] = (int)$category; }
$joins = ' FROM invoice_entry_items i INNER JOIN invoice_entries e ON e.id=i.invoice_id LEFT JOIN internal_invoice_categories c ON c.id=i.internal_category_id';
if (($_GET['view'] ?? '') === 'suggestions') {
    // One deterministic latest price for each independently stored material/category/unit.
    $sql = 'SELECT i.item_name name,i.unit,i.unit_price unitPrice,i.internal_category_id categoryId,c.name categoryName' . $joins . ' WHERE ' . $where . "
      AND NOT EXISTS (SELECT 1 FROM invoice_entry_items newer INNER JOIN invoice_entries ne ON ne.id=newer.invoice_id
        WHERE ne.invoice_scope='internal' AND TRIM(newer.item_name)=TRIM(i.item_name)
        AND COALESCE(newer.unit,'')=COALESCE(i.unit,'') AND newer.internal_category_id <=> i.internal_category_id
        AND (ne.updated_at>e.updated_at OR (ne.updated_at=e.updated_at AND newer.id>i.id)))
      ORDER BY e.updated_at DESC,i.id DESC LIMIT 30";
    $stmt = db()->prepare($sql); $stmt->execute($params);
    $items = $stmt->fetchAll();
    foreach ($items as &$item) { $item['unitPrice']=(float)$item['unitPrice']; $item['categoryId']=$item['categoryId'] === null ? null : (int)$item['categoryId']; }
    unset($item);
    respond_ok(['items'=>$items,'categories'=>$categories]);
}
$page = max(1,(int)($_GET['page'] ?? 1));
$limit = max(1,min(100,(int)($_GET['limit'] ?? 25)));
$group = " GROUP BY TRIM(i.item_name),i.internal_category_id,COALESCE(i.unit,'')";
$stmt = db()->prepare('SELECT COUNT(*) FROM (SELECT 1' . $joins . ' WHERE ' . $where . $group . ') totals');
$stmt->execute($params); $total=(int)$stmt->fetchColumn();
$pages=max(1,(int)ceil($total/$limit)); $page=min($page,$pages); $offset=($page-1)*$limit;
$stmt=db()->prepare("SELECT TRIM(i.item_name) name,i.internal_category_id categoryId,MAX(c.name) categoryName,COALESCE(i.unit,'') unit,SUM(i.quantity) totalReceived" . $joins . ' WHERE ' . $where . $group . ' ORDER BY name,unit LIMIT ' . $limit . ' OFFSET ' . $offset);
$stmt->execute($params); $items=$stmt->fetchAll();
foreach ($items as &$item) { $item['totalReceived']=(float)$item['totalReceived']; $item['categoryId']=$item['categoryId'] === null ? null : (int)$item['categoryId']; }
unset($item);
respond_ok(['items'=>$items,'categories'=>$categories,'pagination'=>['page'=>$page,'pages'=>$pages,'total'=>$total,'limit'=>$limit]]);
