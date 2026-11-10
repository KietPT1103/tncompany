<?php
declare(strict_types=1);
require_once __DIR__.'/../public/api/_lib/takeaway_print_downloads.php';
$files=takeaway_print_downloads();
if(count($files)!==8)throw new RuntimeException('Expected setup, ZIP, two drivers and four checksums.');
foreach($files as $format=>$file){
    if(!str_starts_with($file['key'],'installers/takeaway-print-helper/'))throw new RuntimeException('Must not overwrite cafe or inventory installer keys.');
    if(str_contains($file['file'],'/')||str_contains($file['file'],'..'))throw new RuntimeException('Unsafe artifact filename.');
}
if($files['kv804-driver']['file']!=='kiotviet-kv804-driver.exe')throw new RuntimeException('Wrong bill driver mapping.');
if($files['365b-driver']['file']!=='kiotviet-365b-driver.exe')throw new RuntimeException('Wrong label driver mapping.');
echo "PASS takeaway downloads: separate keys, two drivers, checksum allowlist\n";
