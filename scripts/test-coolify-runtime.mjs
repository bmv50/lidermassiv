import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {copyFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Exercise the production launcher and real Wrangler using synthetic secrets.
// No request is sent to Yandex and the shop's data is never opened.
const root=fileURLToPath(new URL('../',import.meta.url));
await mkdir(path.join(root,'work'),{recursive:true});
const fixture=await mkdtemp(path.join(root,'work','coolify-runtime-'));
for(const dir of ['scripts','dist/server','deploy','node_modules/wrangler/bin','state'])
  await mkdir(path.join(fixture,dir),{recursive:true});
await copyFile(path.join(root,'scripts/coolify-start.mjs'),path.join(fixture,'scripts/coolify-start.mjs'));
await writeFile(path.join(fixture,'node_modules/wrangler/bin/wrangler.js'),
  `const {spawn}=require('node:child_process');
   const child=spawn(process.execPath,[${JSON.stringify(path.join(root,'node_modules/wrangler/bin/wrangler.js'))},...process.argv.slice(2)],{stdio:'inherit'});
   for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
   child.on('error',()=>{process.exitCode=1});child.on('exit',code=>{process.exitCode=code??1});`);
await writeFile(path.join(fixture,'dist/server/wrangler.json'),JSON.stringify({
  name:'coolify-runtime-test',main:'worker.js',compatibility_date:'2026-05-15',
  d1_databases:[{binding:'DB',database_name:'runtime-test',database_id:'00000000-0000-4000-8000-000000000001'}],
}));
await writeFile(path.join(fixture,'deploy/schema.sql'),'CREATE TABLE IF NOT EXISTS runtime_probe (id INTEGER PRIMARY KEY);');
await writeFile(path.join(fixture,'dist/server/worker.js'),`export default {async fetch(req,env){
  const table=await env.DB.prepare("SELECT name FROM sqlite_master WHERE name='runtime_probe'").first();
  return Response.json({provider:env.CONSULTANT_PROVIDER,keyMatches:env.YANDEX_API_KEY==='synthetic-test-key',
    folderMatches:env.YANDEX_FOLDER_ID==='synthetic-folder',demo:env.DEMO_MODE==='true',publicOrigin:env.PUBLIC_ORIGIN,
    unlistedAbsent:env.UNLISTED_TEST_SECRET===undefined,migrated:!!table});
}};`);
const reservation=net.createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');
const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
const child=spawn(process.execPath,[path.join(fixture,'scripts/coolify-start.mjs')],{
  cwd:fixture,stdio:['ignore','pipe','pipe'],windowsHide:true,
  env:{...process.env,PORT:String(port),SITES_RUNTIME_ROOT:path.join(fixture,'state'),
    CONSULTANT_PROVIDER:'yandex',YANDEX_API_KEY:'synthetic-test-key',YANDEX_FOLDER_ID:'synthetic-folder',PUBLIC_ORIGIN:'https://runtime-test.example',
    ADMIN_LOGIN:'runtime-test',ADMIN_PASSWORD_HASH:'synthetic-admin-hash',
    UNLISTED_TEST_SECRET:'not-a-worker-binding',CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_SEND_METRICS:'false',
    WRANGLER_WRITE_LOGS:'false',WRANGLER_LOG_PATH:path.join(fixture,'state','logs'),
    WRANGLER_REGISTRY_PATH:path.join(fixture,'state','registry'),MINIFLARE_REGISTRY_PATH:path.join(fixture,'state','mf-registry')},
});
let logs='';child.stdout.on('data',x=>{logs+=x});child.stderr.on('data',x=>{logs+=x});
try {
  const deadline=Date.now()+45000;let result;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw Error(`Launcher exited with ${child.exitCode}`);
    try{const response=await fetch(`http://127.0.0.1:${port}/`,{signal:AbortSignal.timeout(1000)});if(response.ok){result=await response.json();break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.deepEqual(result,{provider:'yandex',keyMatches:true,folderMatches:true,demo:true,publicOrigin:'https://runtime-test.example',unlistedAbsent:true,migrated:true});
  console.log('PASS: production launcher loads Runtime variables and demo mode; migration persists; unrelated environment is excluded.');
} catch(error){
  console.error(logs.replaceAll('synthetic-test-key','[test key]').replaceAll('synthetic-admin-hash','[test hash]').slice(-5000));
  throw error;
} finally {
  if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
  else child.kill('SIGTERM');
}
