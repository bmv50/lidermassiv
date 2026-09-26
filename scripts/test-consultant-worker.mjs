import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Miniflare} from 'miniflare';
import ts from 'typescript';

// Actual Worker fetch/Request semantics, isolated local upstream, synthetic key.
const output=path.resolve('work/consultant-worker-test');await fs.mkdir(output,{recursive:true});
const source=await fs.readFile('app/lib/consultant.ts','utf8');
await fs.writeFile(path.join(output,'consultant.mjs'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText);
const chatSource=await fs.readFile('app/lib/consultant-chat.ts','utf8');
await fs.writeFile(path.join(output,'consultant-chat.mjs'),ts.transpileModule(chatSource,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace("'./consultant'","'./consultant.mjs'"));
const hits=[];
const upstream=createServer((req,res)=>{
  hits.push(req.url);req.resume();
  if(req.url==='/redirect'){res.writeHead(302,{Location:'/must-not-follow'});res.end();return;}
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(req.url==='/chat'?{text:'Уточним размеры стола.',productIds:['test-table']}:{productIds:['test-table'],questionIds:['dimensions']})}}]}));
});
upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
const port=upstream.address().port;
await fs.writeFile(path.join(output,'worker.mjs'),`
import {requestPlan,failureCode} from './consultant.mjs';
import {requestChat} from './consultant-chat.mjs';
export default {async fetch(req){
  try{
    if(new URL(req.url).pathname==='/chat')return Response.json(await requestChat([{role:'user',content:'Нужен стол'}],
      [{id:'test-table',name:'Стол обеденный',category:'Столы',price:100,discount:10,image:'/test.webp',active:1,stock:1}],
      {CONSULTANT_PROVIDER:'yandex',YANDEX_API_KEY:'synthetic-worker-key',YANDEX_FOLDER_ID:'test-folder'},
      (url,init)=>globalThis.fetch('http://127.0.0.1:${port}/chat',init)));
    const plan=await requestPlan('dining',[{id:'test-table',name:'Test table',category:'Столы',price:100,image:'/test.webp',inStock:true}],
      {CONSULTANT_PROVIDER:'yandex',YANDEX_API_KEY:'synthetic-worker-key',YANDEX_FOLDER_ID:'test-folder'},
      (url,init)=>globalThis.fetch('http://127.0.0.1:${port}'+new URL(req.url).pathname,init));
    return Response.json({plan});
  }catch(error){return Response.json({code:failureCode(error)});}
}};`);
let worker;
try{
  worker=new Miniflare({modules:true,scriptPath:path.join(output,'worker.mjs'),host:'127.0.0.1',port:0,compatibilityDate:'2026-05-15'});
  assert.deepEqual(await(await worker.dispatchFetch('http://localhost/ok')).json(),{plan:{productIds:['test-table'],questionIds:['dimensions']}});
  assert.deepEqual(await(await worker.dispatchFetch('http://localhost/redirect')).json(),{code:'provider_http_302'});
  const chat=await(await worker.dispatchFetch('http://localhost/chat')).json();
  assert.equal(chat.text,'Уточним размеры стола.');assert.equal(chat.products[0].price,90);assert.equal(chat.source,'ai');
  assert.deepEqual(hits,['/ok','/redirect','/chat']);
  console.log('PASS: actual Worker guided and free chat requests succeed; provider redirects are rejected without forwarding credentials.');
}finally{
  await worker?.dispose();upstream.closeAllConnections();await new Promise(resolve=>upstream.close(resolve));
}
