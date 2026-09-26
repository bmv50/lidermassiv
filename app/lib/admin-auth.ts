import {db,runtime} from './shop';
import {isSameOrigin} from './request-origin';

const COOKIE='__Host-lider_admin';
const TTL=8*60*60;
const encoder=new TextEncoder();
const hex=(bytes:ArrayBuffer|Uint8Array)=>Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join('');
async function digest(value:string){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)))}
function token(req:Request){return req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||''}
export function sessionCookie(value:string,maxAge=TTL){return `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`}
export function sameOrigin(req:Request){return isSameOrigin(req,runtime.PUBLIC_ORIGIN)}

export async function isAdmin(req:Request){
 const value=token(req);if(!/^[a-f0-9]{64}$/.test(value)||!runtime.ADMIN_PASSWORD_HASH)return false;
 const row=await db().prepare('SELECT expires_at, credential_version FROM admin_sessions WHERE token_hash = ?').bind(await digest(value)).first<{expires_at:number;credential_version:string}>();
 return !!row&&row.expires_at>Math.floor(Date.now()/1000)&&row.credential_version===await digest(runtime.ADMIN_PASSWORD_HASH);
}
export async function logout(req:Request){const value=token(req);if(/^[a-f0-9]{64}$/.test(value))await db().prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await digest(value)).run()}

export async function login(req:Request,email:unknown,password:unknown){
 const config=String(runtime.ADMIN_PASSWORD_HASH||'').split(':');
 if(config.length!==3||config[0]!=='100000'||!/^[a-f0-9]{64}$/.test(config[1])||!/^[a-f0-9]{64}$/.test(config[2])||!runtime.ADMIN_LOGIN)throw Error('Admin sign-in is not configured');
 const now=Math.floor(Date.now()/1000),window=Math.floor(now/900);
 const identity=req.headers.get('oai-authenticated-user-id')||req.headers.get('cf-connecting-ip')||'unknown';
 const keys=['global',await digest(identity)];
 const attempts=await db().batch(keys.map(key=>db().prepare('INSERT INTO admin_login_attempts (id, window, attempts) VALUES (?, ?, 1) ON CONFLICT(id) DO UPDATE SET window=excluded.window, attempts=CASE WHEN admin_login_attempts.window=excluded.window THEN admin_login_attempts.attempts+1 ELSE 1 END RETURNING attempts').bind(key,window)));
 if(Number((attempts[0].results[0] as {attempts:number})?.attempts)>100||Number((attempts[1].results[0] as {attempts:number})?.attempts)>10)return {status:429,error:'Слишком много попыток. Повторите вход через 15 минут.'};
 if(typeof email!=='string'||typeof password!=='string'||email.length>200||password.length>200)return {status:401,error:'Неверный логин или пароль.'};
 const salt=Uint8Array.from(config[1].match(/../g)!,s=>parseInt(s,16));
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const result=hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:100000},key,256));
 let mismatch=0;for(let i=0;i<64;i++)mismatch|=result.charCodeAt(i)^config[2].charCodeAt(i);
 if(mismatch||email.trim().toLowerCase()!==String(runtime.ADMIN_LOGIN).toLowerCase())return {status:401,error:'Неверный логин или пароль.'};
 const value=hex(crypto.getRandomValues(new Uint8Array(32)));
 await db().batch([
  db().prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now),
  db().prepare('DELETE FROM admin_login_attempts WHERE window < ?').bind(window-1),
  db().prepare('INSERT INTO admin_sessions (token_hash, expires_at, credential_version) VALUES (?, ?, ?)').bind(await digest(value),now+TTL,await digest(runtime.ADMIN_PASSWORD_HASH))
 ]);
 return {status:200,cookie:sessionCookie(value)};
}
