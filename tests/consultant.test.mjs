import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {parseScenario,candidatesFor,validatePlan,referencePlan,renderReply,consultantStatus,requestPlan,contextHash} from '../work/consultant-tests/consultant.mjs';
import {resolvePlan} from '../work/consultant-tests/consultant-cache.mjs';
const product={id:'a',name:'Стол обеденный А',category:'Столы',price:100000,discount:25,image:'/images/a.webp',active:1,stock:1};
const catalog=[product,{...product,id:'b',active:0},{...product,id:'c',discount:0},{...product,id:'d',category:'Комоды'}];
const candidates=candidatesFor('dining',catalog);
const settings={CONSULTANT_PROVIDER:'yandex',YANDEX_API_KEY:'test-key-not-real',YANDEX_FOLDER_ID:'test-folder'};
const plan={productIds:['a'],questionIds:['dimensions']};
function reply(value=plan){return Response.json({choices:[{message:{content:JSON.stringify(value)}}]});}
function database(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('deploy/schema.sql','utf8'));
  return {sqlite,prepare(sql){
    return {bind(...args){
      const stmt=sqlite.prepare(sql);
      return {async first(){return stmt.get(...args)||null},async run(){return stmt.run(...args)}};
    }};
  }};
}
test('only predefined scenarios can cross the demo API boundary',()=>{
  assert.equal(parseScenario({scenario:'dining'}),'dining');
  for(const value of [{scenario:'dining',message:'personal text'},{scenario:'__proto__'},{scenario:'unknown'},{messages:[]},null,[]])assert.throws(()=>parseScenario(value));
});
test('candidate selection respects active state, discount and budget',()=>{
  assert.deepEqual(candidates.map(p=>p.id),['a']);assert.equal(candidates[0].price,75000);
  assert.equal(candidatesFor('delivery',catalog).length,0);
  assert.equal(candidatesFor('dining',[{...product,name:'Стол письменный'}]).length,0);
});
test('recommendations cannot add imaginary products, prices or instructions',()=>{
  assert.deepEqual(validatePlan(plan,candidates),plan);
  for(const value of [{...plan,productIds:['b']},{...plan,price:1},{...plan,productIds:['a','a']},{...plan,questionIds:['__proto__']},{...plan,questionIds:['pay']},{...plan,productIds:[]}])assert.throws(()=>validatePlan(value,candidates));
});
test('custom brief separates standard catalog prices from an unpriced sample project',()=>{
  const result=renderReply('custom',plan,candidates,'ai');assert.equal(result.products[0].price,75000);
  assert.match(result.text,/не является расчётом/);assert.ok(result.brief.some(line=>line.includes('Заявка не отправлена')));
});
test('missing configuration stays in reference mode',()=>{
  assert.equal(consultantStatus({}).configured,false);
  assert.equal(consultantStatus({CONSULTANT_PROVIDER:'n8n',CONSULTANT_N8N_URL:'http://test',CONSULTANT_N8N_TOKEN:'test'}).configured,false);
  assert.equal(consultantStatus(settings).configured,true);
});
test('Yandex request uses fixed endpoint, server credential and no conversation storage',async()=>{
  const result=await requestPlan('dining',candidates,settings,async(url,init)=>{
    assert.equal(url,'https://ai.api.cloud.yandex.net/v1/chat/completions');assert.equal(init.headers.Authorization,'Bearer test-key-not-real');
    assert.equal(init.headers['x-data-logging-enabled'],'false');assert.equal(init.redirect,'error');
    const body=JSON.parse(init.body);assert.equal(body.store,false);assert.equal(body.model,'gpt://test-folder/yandexgpt-5.1');
    assert.equal(body.messages.length,2);assert.ok(body.max_tokens<=500);assert.equal(body.tools,undefined);return reply();
  });assert.deepEqual(result,plan);
});
test('n8n receives a public request and its own authentication, never a Yandex key',async()=>{
  await requestPlan('dining',candidates,{...settings,CONSULTANT_PROVIDER:'n8n',CONSULTANT_N8N_URL:'https://n8n.example/webhook/consultant',CONSULTANT_N8N_TOKEN:'gateway-secret'},async(url,init)=>{
    assert.equal(init.headers['X-Consultant-Token'],'gateway-secret');assert.equal(init.headers.Authorization,undefined);
    assert.ok(!init.body.includes('test-key-not-real'));assert.equal(JSON.parse(init.body).schema,'consultant.v1');return reply();
  });
});
test('malformed, oversized or failed upstream responses are rejected',async()=>{
  await assert.rejects(requestPlan('dining',candidates,settings,async()=>new Response('error',{status:500})));
  await assert.rejects(requestPlan('dining',candidates,settings,async()=>new Response('x'.repeat(17000))));
  await assert.rejects(requestPlan('dining',candidates,settings,async()=>reply({...plan,productIds:['invented']})));
});
test('catalog edits invalidate the cache context',async()=>{
  const original=await contextHash('dining',candidates,settings);
  assert.notEqual(original,await contextHash('dining',[{...candidates[0],price:72000}],settings));
  assert.notEqual(original,await contextHash('dining',[{...candidates[0],inStock:false}],settings));
});
test('cache persists a validated plan and reuses it without another paid call',async()=>{
  const db=database();const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return reply();};
  try {assert.equal((await resolvePlan(db,'dining',candidates,settings)).source,'ai');assert.equal((await resolvePlan(db,'dining',candidates,settings)).source,'ai');assert.equal(calls,1);assert.equal(db.sqlite.prepare('SELECT attempts FROM consultant_daily_budget').get().attempts,1);}finally{globalThis.fetch=previous;db.sqlite.close();}
});
test('simultaneous cold requests acquire only one paid-call lease',async()=>{
  const db=database();const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;await new Promise(r=>setTimeout(r,25));return reply();};
  try {const results=await Promise.all(Array.from({length:10},()=>resolvePlan(db,'dining',candidates,settings)));assert.equal(calls,1);assert.ok(results.some(r=>r.source==='ai'));assert.equal(db.sqlite.prepare('SELECT attempts FROM consultant_daily_budget').get().attempts,1);}finally{globalThis.fetch=previous;db.sqlite.close();}
});
test('daily global budget limits paid attempts even across scenarios',async()=>{
  const db=database();const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return reply();};
  try {await resolvePlan(db,'dining',candidates,{...settings,CONSULTANT_DAILY_LIMIT:1});const next=await resolvePlan(db,'custom',candidates,{...settings,CONSULTANT_DAILY_LIMIT:1});assert.equal(next.source,'reference');assert.equal(calls,1);}finally{globalThis.fetch=previous;db.sqlite.close();}
});
test('provider failure returns factual fallback and avoids immediate repeated billing',async()=>{
  const db=database();const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unavailable');};
  try {assert.equal((await resolvePlan(db,'dining',candidates,settings)).source,'reference');assert.equal((await resolvePlan(db,'dining',candidates,settings)).source,'reference');assert.equal(calls,1);}finally{globalThis.fetch=previous;db.sqlite.close();}
});
test('missing cache schema fails before any upstream call',async()=>{
  const db=database();db.sqlite.exec('DROP TABLE consultant_demo_cache');const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return reply();};
  try {await assert.rejects(resolvePlan(db,'dining',candidates,settings));assert.equal(calls,0);}finally{globalThis.fetch=previous;db.sqlite.close();}
});
