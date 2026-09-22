import {login,logout,sameOrigin,sessionCookie} from '../../lib/admin-auth';
export const dynamic='force-dynamic';
const reply=(value:object,status=200,cookie?:string)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export async function POST(req:Request){
 if(!sameOrigin(req))return reply({error:'Недопустимый источник запроса.'},403);
 try{
  const body=await req.text();if(body.length>2000)return reply({error:'Слишком большой запрос.'},413);
  let data;try{data=JSON.parse(body)}catch{return reply({error:'Некорректный запрос.'},400)}
  if(data.action==='logout'){await logout(req);return reply({ok:true},200,sessionCookie('',0))}
  if(data.action!=='login')return reply({error:'Действие не найдено.'},400);
  const result=await login(req,data.login,data.password);
  return reply(result.status===200?{ok:true}:{error:result.error},result.status,result.cookie);
 }catch{return reply({error:'Вход временно недоступен. Попробуйте позже.'},503)}
}
