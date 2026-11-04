import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
const directory=mkdtempSync(join(tmpdir(),'tn-revenue-access-'));
const root=resolve('public/api').replaceAll('\\','/');
const database=join(directory,'test.sqlite').replaceAll('\\','/');
const phpString=value=>"'"+value.replaceAll("'","\\'")+"'";
// Use real auth checks with a precreated SQLite fixture; omit only the MySQL schema migration.
const authFixture=join(directory,'auth.php').replaceAll('\\','/');
writeFileSync(authFixture,readFileSync(root+'/_lib/auth.php','utf8').replace('auth_ensure_tables();','').replaceAll('NOW()', 'CURRENT_TIMESTAMP').replaceAll("__DIR__ . '/",phpString(root+'/_lib/')+' . '+"'"));
const codeEndpoint=join(directory,'code.php').replaceAll('\\','/');
writeFileSync(codeEndpoint,readFileSync(root+'/revenue-access-code.php','utf8').replaceAll("__DIR__ . '/",phpString(root+'/')+' . '+"'").replace(phpString(root+'/')+" . '_lib/auth.php'",phpString(authFixture)));
const router=join(directory,'router.php');
writeFileSync(router,`<?php require_once ${phpString(root+'/_lib/bootstrap.php')}; $config=['db_driver'=>'sqlite','db_database'=>${phpString(database)}]; $path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH); if(!in_array($path,['/revenue-access.php','/revenue-access-code.php','/revenue-hub.php'],true)){http_response_code(404);exit;} if($path==='/revenue-access-code.php'){require ${phpString(codeEndpoint)};}else{require ${phpString(root)}.$path;}`);
const seed=join(directory,'seed.php');
writeFileSync(seed,`<?php $p=new PDO('sqlite:'.${phpString(database)});$p->exec("CREATE TABLE users(id TEXT,email TEXT,username TEXT,display_name TEXT,role TEXT,store_id TEXT,permissions_json TEXT,is_active INTEGER); CREATE TABLE api_tokens(user_id TEXT,token_hash TEXT,expires_at TEXT);CREATE TABLE user_store_access(user_id TEXT,store_id TEXT);INSERT INTO users VALUES('admin','admin@example.test','admin','Admin','admin',NULL,'[]',1),('user','user@example.test','user','User','user',NULL,'[]',1);");$s=$p->prepare('INSERT INTO api_tokens VALUES(?,?,?)');foreach(['admin','user'] as $id)$s->execute([$id,hash('sha256',$id.'-token'),'2099-01-01 00:00:00']);`);
const init=spawnSync('php',[seed],{encoding:'utf8'});assert.equal(init.status,0,init.stderr);
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const server=spawn('php',['-S','127.0.0.1:'+port,router],{stdio:'ignore',windowsHide:true});
async function request(path,token,body){const response=await fetch('http://127.0.0.1:'+port+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,...await response.json()};}
try{
 let ready=false;for(let i=0;i<50;i++){try{await request('/revenue-access.php');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(ready,'PHP server starts');
 assert.equal((await request('/revenue-access.php')).data.unlocked,false);
 const visitor=await request('/revenue-access-code.php',undefined,{});assert.equal(visitor.status,401,JSON.stringify(visitor));
 assert.equal((await request('/revenue-access-code.php','user-token',{})).status,403,'Regular account cannot generate code');
 const generated=await request('/revenue-access-code.php','admin-token',{});assert.equal(generated.status,200,JSON.stringify(generated));assert.match(generated.data.code,/^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/);
 const query='/revenue-hub.php?source=invalid&from=2026-11-04&to=2026-11-04';
 assert.equal((await request(query)).status,403,'Report is locked without token');
 assert.equal((await request(query,'admin-token')).status,403,'Admin account cannot bypass code');
 assert.equal((await request('/revenue-access.php',undefined,{code:'bad'})).status,403);
 const unlocked=await request('/revenue-access.php',undefined,{code:generated.data.code});assert.equal(unlocked.status,200);const token=unlocked.data.token;
 assert.equal((await request('/revenue-access.php',token)).data.unlocked,true);
 assert.equal((await request(query,token)).status,422,'Valid revenue token reaches report input validation');
 assert.equal((await request('/revenue-access-code.php',token,{})).status,401,'Revenue token grants no admin access');
 const custom=await request('/revenue-access-code.php','admin-token',{code:'My-Code-123'});assert.equal(custom.data.code,'My-Code-123');
 assert.equal((await request('/revenue-access.php',token)).data.unlocked,false,'Rotation revokes remembered token');
 assert.equal((await request(query,token)).status,403);
 assert.equal((await request('/revenue-access.php',undefined,{code:generated.data.code})).status,403,'Old code denied');
 assert.equal((await request('/revenue-access.php',undefined,{code:'My-Code-123'})).status,200,'Custom code accepted');
 console.log('Revenue access HTTP: PASS');
}finally{server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+'\\')||target.startsWith(resolve(tmpdir())+'/'));rmSync(target,{recursive:true,force:true});}
