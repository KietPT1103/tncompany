<?php
declare(strict_types=1);
require_once __DIR__ . '/../public/api/_lib/search.php';
$source=file_get_contents(__DIR__ . '/../public/api/activity-logs.php');
$start=strpos($source,'function activity_build_log_conditions(');
$end=strpos($source,'function activity_extract_legacy_screenshot(', $start);
eval(substr($source,$start,$end-$start));
[$where,$params]=activity_build_log_conditions([],true);
$db=new PDO('sqlite::memory:');
$db->exec('CREATE TABLE activity_logs (has_screenshot INTEGER)');
$db->exec('INSERT INTO activity_logs VALUES (0),(1),(0),(1)');
$count=(int)$db->query('SELECT COUNT(*) FROM activity_logs WHERE '.$where)->fetchColumn();
if($count!==2 || $params!==[])throw new RuntimeException('Screenshot filter counts incorrect records');
if(!str_contains($source,'activity_build_log_conditions($filters, true)'))throw new RuntimeException('List does not apply screenshot filter');
echo "PASS screenshot-only condition excludes events without images before counting and pagination\n";
