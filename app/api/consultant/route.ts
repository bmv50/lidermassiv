import {allProducts,db,runtime} from '../../lib/shop';
import {candidatesFor,consultantStatus,parseScenario,renderReply,referencePlan} from '../../lib/consultant';
import {resolvePlan} from '../../lib/consultant-cache';
import {isSameOrigin} from '../../lib/request-origin';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){return json(consultantStatus(runtime));}
export async function POST(req:Request){
  if(!isSameOrigin(req,runtime.PUBLIC_ORIGIN)) return json({error:'Недопустимый источник запроса.'},403);
  if(!req.headers.get('content-type')?.startsWith('application/json')) return json({error:'Ожидается JSON.'},415);
  const reader=req.body?.getReader();if(!reader)return json({error:'Выберите пример запроса.'},400);
  let body='';const decoder=new TextDecoder();let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>512){await reader.cancel();return json({error:'Запрос слишком большой.'},413);}body+=decoder.decode(value,{stream:true});}
  body+=decoder.decode();
  let scenario;try{scenario=parseScenario(JSON.parse(body));}catch{return json({error:'В демо доступны только готовые примеры запросов.'},400);}
  try {
    const candidates=candidatesFor(scenario,await allProducts());
    // Failure to acquire a DB budget never initiates a paid upstream request.
    let result={plan:referencePlan(scenario,candidates),source:'reference' as 'ai'|'reference'};
    try{result=await resolvePlan(db(),scenario,candidates,runtime);}catch{}
    return json(renderReply(scenario,result.plan,candidates,result.source));
  } catch {return json({error:'Каталог временно недоступен. Попробуйте ещё раз.'},503);}
}
