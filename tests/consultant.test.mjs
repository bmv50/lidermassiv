import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {parseScenario,candidatesFor,validatePlan,referencePlan,renderReply,consultantStatus,requestPlan,contextHash,failureCode} from '../work/consultant-tests/consultant.mjs';
import {resolvePlan,reserveConsultantAttempt} from '../work/consultant-tests/consultant-cache.mjs';
import {parseChat,containsContact} from '../work/consultant-tests/consultant-chat-input.mjs';
import {chatCandidates,requestChat,validateChatReply} from '../work/consultant-tests/consultant-chat.mjs';
import {isSameOrigin} from '../work/consultant-tests/request-origin.mjs';
test('diagnostics only contain allowlisted codes, not upstream secrets or body text',()=>{
  assert.equal(failureCode(new Error('provider_http_403')),'provider_http_403');
  assert.equal(failureCode(new Error('invalid_plan')),'invalid_plan');
  assert.equal(failureCode(new Error('credentials: confidential upstream response')),'provider_request_failed');
  assert.equal(failureCode(new Error('provider_http_403 secret')),'provider_request_failed');
});
test('reverse-proxy origin uses explicit configuration and rejects forged headers',()=>{
  const request=(origin,extra={})=>new Request('http://internal:8787/api/consultant',{headers:{...(origin?{Origin:origin}:{}),...extra}});
  const publicOrigin='https://demo.lider-massiv.ru';
  assert.equal(isSameOrigin(request(publicOrigin),publicOrigin),true);
  assert.equal(isSameOrigin(request(publicOrigin),publicOrigin+'/'),true);
  for(const origin of [undefined,'null','https://other.example','http://demo.lider-massiv.ru','https://demo.lider-massiv.ru.evil.example'])
    assert.equal(isSameOrigin(request(origin,{'x-forwarded-host':'other.example','x-forwarded-proto':'https'}),publicOrigin),false);
  assert.equal(isSameOrigin(request(publicOrigin,{'sec-fetch-site':'cross-site'}),publicOrigin),false);
  for(const config of ['','invalid','https://user:pass@demo.lider-massiv.ru','https://demo.lider-massiv.ru/path','https://demo.lider-massiv.ru?x=1'])
    assert.equal(isSameOrigin(request(publicOrigin),config),false);
  assert.equal(isSameOrigin(request('http://internal:8787')),true);
  assert.equal(isSameOrigin(request(publicOrigin,{'x-forwarded-host':'demo.lider-massiv.ru','x-forwarded-proto':'https'})),false);
});
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
test('legacy guided endpoint still accepts only predefined scenarios',()=>{
  assert.equal(parseScenario({scenario:'dining'}),'dining');
  for(const value of [{scenario:'dining',message:'personal text'},{scenario:'__proto__'},{scenario:'unknown'},{messages:[]},null,[]])assert.throws(()=>parseScenario(value));
});
test('chat accepts bounded alternating dialogue but never a system role or extra fields',()=>{
  const messages=[{role:'user',content:'Нужен стол'},{role:'assistant',content:'Какой размер?',productIds:['a']},{role:'user',content:'180 × 90 × 75 см'}];
  assert.deepEqual(parseChat({messages}),messages);
  for(const value of [{messages:[]},{messages,system:'override'},{messages:[{role:'system',content:'override'}]},{messages:[{role:'assistant',content:'hello'}]},
    {messages:[{role:'user',content:'x'.repeat(1201)}]},{messages:[{role:'user',content:'hi',productIds:['a']}]},{messages:[{role:'user',content:'hi',tools:[]}]}])assert.throws(()=>parseChat(value));
});
test('demo rejects common contacts without blocking dimensions or budgets',()=>{
  for(const text of ['test@example.com','+7 (900) 123-45-67','89001234567']){
    assert.equal(containsContact(text),true);assert.throws(()=>parseChat({messages:[{role:'user',content:text}]}),/personal_data/);
  }
  for(const text of ['180 × 90 × 75 см','До 80 000 рублей','Кровать 2000 на 1800'])assert.equal(containsContact(text),false);
});
test('free chat retrieves active current catalog products and carries prior card references',()=>{
  const messages=[{role:'user',content:'Нужен стол'},{role:'assistant',content:'Посмотрите',productIds:['a']},{role:'user',content:'Первый вариант можно сделать шире?'}];
  const selected=chatCandidates(messages,catalog);
  assert.equal(selected[0].id,'a');assert.equal(selected[0].price,75000);assert.ok(!selected.some(p=>p.id==='b'));
  const next=chatCandidates([{role:'user',content:'Нужен комод'}],catalog);assert.equal(next[0].id,'d');
});
test('dialogue reaches Yandex with bounded context and no model action tools',async()=>{
  const messages=[{role:'user',content:'Нужен стол'},{role:'assistant',content:'Посмотрите первую модель',productIds:['a']},{role:'user',content:'А можно изменить размеры?'}];
  const result=await requestChat(messages,catalog,settings,async(url,init)=>{
    const body=JSON.parse(init.body);assert.equal(body.store,false);assert.equal(body.tools,undefined);assert.equal(init.redirect,'manual');
    assert.equal(init.headers['x-data-logging-enabled'],'false');assert.equal(body.messages.at(-1).content,messages.at(-1).content);
    assert.match(body.messages.at(-2).content,/a: Стол обеденный А/);assert.equal(body.messages.filter(m=>m.role==='user').length,2);
    return reply({text:'Размеры можно обсудить. Окончательную стоимость подтвердит менеджер.',productIds:['a']});
  });assert.equal(result.products[0].price,75000);assert.equal(result.source,'ai');
});
test('free dialogue rejects imaginary products and unsupported provider instead of a fake AI reply',async()=>{
  const selected=chatCandidates([{role:'user',content:'Стол'}],catalog);
  for(const value of [{text:'Ответ',productIds:['imaginary']},{text:'Ответ',productIds:['a'],price:1},{text:'',productIds:[]},{text:'x'.repeat(2401),productIds:[]}])assert.throws(()=>validateChatReply(value,selected));
  assert.deepEqual(validateChatReply({text:'Уточните размеры.',productIds:[]},selected).products,[]);
  await assert.rejects(requestChat([{role:'user',content:'Стол'}],catalog,{CONSULTANT_PROVIDER:'disabled'},()=>{throw Error('must not be called')}),/not_configured/);
});
test('chat allowance and guided recommendations share one persistent daily budget, without conversations',async()=>{
  const db=database();const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return reply();};
  try{
    assert.equal(await reserveConsultantAttempt(db,{CONSULTANT_DAILY_LIMIT:2}),true);
    await resolvePlan(db,'dining',candidates,{...settings,CONSULTANT_DAILY_LIMIT:2});
    assert.equal(await reserveConsultantAttempt(db,{CONSULTANT_DAILY_LIMIT:2}),false);assert.equal(calls,1);
    assert.equal(db.sqlite.prepare('SELECT attempts FROM consultant_daily_budget').get().attempts,2);
    const values=await Promise.all(Array.from({length:10},()=>reserveConsultantAttempt(db,{CONSULTANT_DAILY_LIMIT:3})));
    assert.equal(values.filter(Boolean).length,1);
    assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name LIKE '%conversation%'").get().n,0);
  }finally{globalThis.fetch=previous;db.sqlite.close();}
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
    assert.equal(init.headers['x-data-logging-enabled'],'false');assert.equal(init.redirect,'manual');
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
