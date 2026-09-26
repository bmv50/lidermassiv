import {consultantStatus,contextHash,referencePlan,requestPlan,validatePlan,failureCode,type Scenario,type ProductCard,type Plan} from './consultant';
type CacheRow = {context_hash:string;payload:string;expires_at:number};
// One shared, atomic allowance for guided recommendations and free chat.
export async function reserveConsultantAttempt(database:D1Database,settings:Record<string,unknown>,now=Date.now()):Promise<boolean> {
  const configuredLimit=Number(settings.CONSULTANT_DAILY_LIMIT || 20);
  const limit=Number.isFinite(configuredLimit)?Math.max(1,Math.min(100,Math.floor(configuredLimit))):20;
  const day=new Date(now).toISOString().slice(0,10);
  await database.prepare('DELETE FROM consultant_daily_budget WHERE day < ?').bind(new Date(now-8*86400000).toISOString().slice(0,10)).run();
  return !!await database.prepare(`INSERT INTO consultant_daily_budget(day,attempts) VALUES (?,1)
    ON CONFLICT(day) DO UPDATE SET attempts=attempts+1 WHERE attempts < ? RETURNING attempts`).bind(day,limit).first();
}
// Both tables are shared counters/cache; never contain visitor identifiers or conversations.
export async function resolvePlan(database:D1Database,scenario:Scenario,candidates:ProductCard[],settings:Record<string,unknown>):Promise<{plan:Plan;source:'ai'|'reference'}> {
  const fallback={plan:referencePlan(scenario,candidates),source:'reference' as const};
  if(scenario==='delivery' || !candidates.length || !consultantStatus(settings).configured) return fallback;
  const hash=await contextHash(scenario,candidates,settings), now=Date.now();
  const row=await database.prepare('SELECT context_hash,payload,expires_at FROM consultant_demo_cache WHERE scenario=?').bind(scenario).first<CacheRow>();
  if(row?.context_hash===hash && row.expires_at>now) {
    try {const value=JSON.parse(row.payload);return {plan:validatePlan(value.plan,candidates),source:value.source==='ai'?'ai':'reference'};} catch { /* Refresh corrupted/obsolete cache. */ }
  }
  const lease=crypto.randomUUID();
  const lock=await database.prepare(`INSERT INTO consultant_demo_cache (scenario,context_hash,payload,expires_at,lease_id,lease_until)
    VALUES (?,?,'',0,?,?) ON CONFLICT(scenario) DO UPDATE SET lease_id=excluded.lease_id,lease_until=excluded.lease_until
    WHERE consultant_demo_cache.lease_until <= ? AND (consultant_demo_cache.expires_at <= ? OR consultant_demo_cache.context_hash != ?)
    RETURNING lease_id`).bind(scenario,hash,lease,now+60000,now,now,hash).first();
  if(!lock) return fallback;
  try {
    const allowance=await reserveConsultantAttempt(database,settings,now);
    let result=fallback as {plan:Plan;source:'ai'|'reference'};
    if(allowance) {
      try {result={plan:await requestPlan(scenario,candidates,settings),source:'ai'};} catch(error) {
        // Only a fixed diagnostic code, never error bodies, credentials or model output.
        console.warn('[consultant]',JSON.stringify({scenario,code:failureCode(error)}));
      }
    }
    await database.prepare(`UPDATE consultant_demo_cache SET context_hash=?,payload=?,expires_at=?,lease_until=0,lease_id=''
      WHERE scenario=? AND lease_id=?`).bind(hash,JSON.stringify(result),now+(result.source==='ai'?86400000:120000),scenario,lease).run();
    return result;
  } finally {
    await database.prepare("UPDATE consultant_demo_cache SET lease_until=0,lease_id='' WHERE scenario=? AND lease_id=?").bind(scenario,lease).run();
  }
}
