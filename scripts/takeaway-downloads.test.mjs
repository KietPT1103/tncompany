import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const source=readFileSync('src/app/download-inventory-print-helper/takeawayDownloadConfig.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {takeawayPrintDownloads,takeawayZipUrl}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const manifest=JSON.parse(execFileSync('php',['-r',"require 'public/api/_lib/takeaway_print_downloads.php'; echo json_encode(takeaway_print_downloads());"],{encoding:'utf8'}));
assert.deepEqual(takeawayPrintDownloads.map(x=>x.id),['exe','kv804-driver','365b-driver']);
for(const item of takeawayPrintDownloads){
 assert.equal(item.filename,manifest[item.id].file);
 assert.equal(item.url,`/api/download-takeaway-print-helper.php?format=${item.id}`);
 assert.equal(item.checksumUrl,`/api/download-takeaway-print-helper.php?format=${item.id}-sha256`);
 assert.ok(manifest[`${item.id}-sha256`]);
}
assert.equal(takeawayZipUrl,'/api/download-takeaway-print-helper.php?format=zip');
assert.ok(readFileSync('src/app/download-inventory-print-helper/page.tsx','utf8').includes('<TakeawayDownloadSection />'));
assert.equal(JSON.parse(execFileSync('php',['-r',"require 'public/api/_lib/takeaway_print_downloads.php'; echo json_encode(isset(takeaway_print_downloads()['../config.php']));"],{encoding:'utf8'})),false);
console.log('PASS takeaway download links match server manifest; existing page includes new downloads');
