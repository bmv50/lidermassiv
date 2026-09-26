import {allProducts,db,runtime} from '../../../lib/shop';
import {consultantStatus,failureCode} from '../../../lib/consultant';
import {parseChat,personalDataHint} from '../../../lib/consultant-chat-input';
import {requestChat} from '../../../lib/consultant-chat';
import {reserveConsultantAttempt} from '../../../lib/consultant-cache';
import {isSameOrigin} from '../../../lib/request-origin';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){
  if(!isSameOrigin(req,runtime.PUBLIC_ORIGIN))return json({error:'Недопустимый источник запроса.'},403);
  if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'Ожидается JSON.'},415);
  const reader=req.body?.getReader();if(!reader)return json({error:'Напишите вопрос о мебели.'},400);
  let body='',size=0;const decoder=new TextDecoder();
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();return json({error:'Диалог слишком длинный. Начните новый разговор.'},413);}body+=decoder.decode(value,{stream:true});}
  body+=decoder.decode();
  let messages;try{messages=parseChat(JSON.parse(body));}catch(error){return json({error:error instanceof Error&&error.message==='personal_data'?personalDataHint:'Не удалось прочитать сообщение. Начните новый разговор.'},400);}
  if(!consultantStatus(runtime).chatConfigured)return json({error:'Свободный диалог временно недоступен: подключение YandexGPT не настроено.'},503);
  try {
    const catalogue=await allProducts();
    if(!await reserveConsultantAttempt(db(),runtime))return json({error:'На сегодня достигнут лимит ответов демоверсии. Можно продолжить завтра или посмотреть товары в каталоге.'},429);
    // Visitor text is transient: no conversation table, shared cache or body logging.
    return json(await requestChat(messages,catalogue,runtime));
  }catch(error){
    console.warn('[consultant]',JSON.stringify({mode:'chat',code:failureCode(error)}));
    return json({error:'Консультант сейчас не смог ответить. Ваш вопрос остался в чате — попробуйте отправить его ещё раз.'},503);
  }
}
