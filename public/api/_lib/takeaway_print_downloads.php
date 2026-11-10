<?php
declare(strict_types=1);
function takeaway_print_downloads(): array
{
    $files=[
        'exe'=>['file'=>'TN-Company-Takeaway-Print-Helper-Setup.exe','type'=>'application/vnd.microsoft.portable-executable'],
        'zip'=>['file'=>'tn-company-takeaway-print-helper-windows-x64.zip','type'=>'application/zip'],
        'kv804-driver'=>['file'=>'kiotviet-kv804-driver.exe','type'=>'application/vnd.microsoft.portable-executable'],
        '365b-driver'=>['file'=>'kiotviet-365b-driver.exe','type'=>'application/vnd.microsoft.portable-executable'],
    ];
    foreach($files as $format=>$item)$files[$format.'-sha256']=['file'=>$item['file'].'.sha256','type'=>'text/plain; charset=utf-8'];
    foreach($files as &$item)$item['key']='installers/takeaway-print-helper/'.$item['file'];
    unset($item);return $files;
}
