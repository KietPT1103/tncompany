<?php
declare(strict_types=1);
// Exercise the actual endpoint query against isolated data, without live credentials.
$source = file_get_contents(__DIR__ . '/../public/api/inventory-warehouse-products.php');
if (!preg_match("/prepare\\('(.+?)'\\);/s", $source, $match)) throw new RuntimeException('Query not found');
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE inventory_receipts (id TEXT,store_id TEXT,status TEXT,created_at TEXT)');
$pdo->exec('CREATE TABLE inventory_receipt_items (id INTEGER,receipt_id TEXT,ingredient_id TEXT,product_code TEXT,product_name TEXT,unit TEXT,item_type TEXT)');
$pdo->exec('CREATE TABLE ingredients (id TEXT,store_id TEXT,is_active INTEGER)');
$pdo->exec("INSERT INTO ingredients VALUES ('a','cafe',1),('inactive','cafe',0)");
$pdo->exec("INSERT INTO inventory_receipts VALUES ('r1','cafe','completed','2026-10-01'),('r2','restaurant','completed','2026-10-02'),('r3','cafe','cancelled','2026-10-03'),('r4','cafe','deleted','2026-10-04'),('r5','cafe','draft','2026-10-05')");
$pdo->exec("INSERT INTO inventory_receipt_items VALUES (1,'r1','a','A','Coffee','kg','ingredient'),(2,'r1',NULL,'E','Cup','piece','equipment'),(3,'r2',NULL,'X','Other store','piece','equipment'),(4,'r3',NULL,'C','Cancelled','piece','equipment'),(5,'r4',NULL,'D','Deleted','piece','equipment'),(6,'r5',NULL,'E','Cup','piece','equipment'),(7,'r1','inactive','I','Inactive','kg','ingredient')");
$query = $pdo->prepare($match[1]);
function findItems(string $type, string $term='%'): array { global $query; $query->execute(['store'=>'cafe','type'=>$type,'name'=>$term,'code'=>$term]); return $query->fetchAll(); }
$equipment = findItems('equipment');
if (count($equipment)!==1 || $equipment[0]['product_name']!=='Cup') throw new RuntimeException('Equipment isolation/deduplication failed');
$ingredients = findItems('ingredient');
if (count($ingredients)!==1 || $ingredients[0]['product_name']!=='Coffee') throw new RuntimeException('Ingredient isolation/active filter failed');
if (count(findItems('equipment','%Cup%'))!==1 || findItems('equipment','%Coffee%')!==[]) throw new RuntimeException('Search filter failed');
echo "PASS warehouse suggestions: store/type isolation, cancelled/deleted exclusion, active ingredients, deduplication, search\n";
