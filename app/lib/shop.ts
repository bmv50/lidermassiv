import {env} from 'cloudflare:workers';
import seed from '../data/products.json';
export const runtime=env as unknown as Record<string,any>;
export function db(){if(!runtime.DB)throw Error('Хранилище временно недоступно. Попробуйте позже.');return runtime.DB as D1Database}
export async function allProducts(){const result=await db().prepare('SELECT payload FROM products').all<{payload:string}>();const overrides=new Map((result.results||[]).map(r=>{const p=JSON.parse(r.payload);return [p.id,p]}));return [...seed.map(p=>overrides.get(p.id)||p),...[...overrides.values()].filter(p=>!seed.some(s=>s.id===p.id))]}
export function isAdmin(req:Request){return req.headers.get('oai-authenticated-user-email')?.toLowerCase()==='mrbaranov@yandex.ru'&&!!req.headers.get('oai-authenticated-user-id')}
export function customer(req:Request){const id=req.headers.get('oai-authenticated-user-id');if(id)return {id:'user:'+id,cookie:null};const token=req.headers.get('cookie')?.match(/(?:^|; )lider_session=([a-f0-9-]{36})(?:;|$)/)?.[1];const sid=token||crypto.randomUUID();return {id:'guest:'+sid,cookie:token?null:`lider_session=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`}}
export async function getCart(id:string){const r=await db().prepare('SELECT payload FROM carts WHERE id = ?').bind(id).first<{payload:string}>();return r?JSON.parse(r.payload):{}}
