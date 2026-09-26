'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUp,ArrowUpRight,Check,LoaderCircle,Plus,RotateCcw,Sparkles,X} from 'lucide-react';
import {scenarios,type ProductCard} from './lib/consultant';
import {CHAT_INPUT_LIMIT,CHAT_CONTEXT_MESSAGES,containsContact,personalDataHint,type ChatMessage} from './lib/consultant-chat-input';
import type {ChatReply} from './lib/consultant-chat';
import './consultant.css';
export type ChatTurn={role:'user'|'assistant';content:string;products?:ProductCard[]};
export type ChatSession={turns:ChatTurn[];draft:string};
const money=(value:number)=>new Intl.NumberFormat('ru-RU').format(value)+' ₽';
function context(turns:ChatTurn[]):ChatMessage[]{
  const result=turns.slice(-CHAT_CONTEXT_MESSAGES).map(({role,content,products})=>({role,content,...(products?.length?{productIds:products.map(p=>p.id)}:{})}));
  while(result.length>1&&result.reduce((n,m)=>n+m.content.length,0)>10000)result.splice(0,2);
  return result;
}
export default function Consultant({session,onSession,onClose,onSelect,onAdd}:{session:ChatSession;onSession:(session:ChatSession)=>void;onClose:()=>void;onSelect:(id:string)=>void;onAdd:(id:string)=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[added,setAdded]=useState<string[]>([]);
  const panel=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null),body=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null),controller=useRef<AbortController|null>(null);
  const {turns,draft}=session;
  const pending=turns.at(-1)?.role==='user';
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';close.current?.focus();return()=>{controller.current?.abort();document.body.style.overflow=overflow;previous?.focus();}},[]);
  useEffect(()=>{body.current?.scrollTo({top:turns.length||error?body.current.scrollHeight:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});},[turns,busy,error]);
  async function send(text:string,retry=false){
    if(busy||!text.trim())return;
    if(containsContact(text)){setError(personalDataHint);input.current?.focus();return;}
    const previous=pending?turns.slice(0,-1):turns;
    const nextTurns:ChatTurn[]=[...previous,{role:'user' as const,content:text.trim()}].slice(-39);
    const request=new AbortController();controller.current=request;
    setBusy(true);setError('');onSession({turns:nextTurns,draft:retry?draft:''});
    try{
      const response=await fetch('/api/consultant/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:context(nextTurns)}),signal:request.signal});
      const value=await response.json() as ChatReply & {error?:string};
      if(!response.ok)throw Error(value.error||'Не удалось получить ответ. Попробуйте ещё раз.');
      if(!request.signal.aborted)onSession({turns:[...nextTurns,{role:'assistant',content:value.text,products:value.products}],draft:retry?draft:''});
    }catch(error){if(!request.signal.aborted)setError(error instanceof Error?error.message:'Не удалось получить ответ. Проверьте соединение.');}
    finally{if(!request.signal.aborted)setBusy(false);}
  }
  function reset(){controller.current?.abort();setBusy(false);setError('');setAdded([]);onSession({turns:[],draft:''});input.current?.focus();}
  return <div className="consultant-shade" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <aside className="consultant" role="dialog" aria-modal="true" aria-labelledby="consultant-title" ref={panel} onKeyDown={e=>{
      if(e.key==='Escape'){e.stopPropagation();onClose();}
      if(e.key==='Tab'){const controls=panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],textarea:not(:disabled)');if(!controls?.length)return;const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    }}>
      <header className="consultant-header"><span className="consultant-mark"><Sparkles size={23}/></span><div><small>ЛИДЕР МАССИВ · ИИ-КОНСУЛЬТАНТ</small><h2 id="consultant-title">Начнём с вашей идеи</h2></div><button ref={close} className="consultant-close" onClick={onClose} aria-label="Закрыть консультанта"><X size={21}/></button></header>
      <div className="consultant-toolbar"><span className="consultant-demo"><span/>Демонстрация · YandexGPT</span>{!!turns.length&&<button onClick={reset} className="consultant-reset"><RotateCcw size={13}/>Новый диалог</button>}</div>
      <div className="consultant-body" ref={body}>
        {!turns.length&&<><h3 className="consultant-welcome">Мебель, которая<br/><em>подойдёт именно вам.</em></h3><p className="consultant-intro">Расскажите, что вы ищете. Обсудим размеры, стиль и отделку — и найдём варианты в каталоге.</p><div className="consultant-choices">{Object.entries(scenarios).map(([id,scenario],i)=><button key={id} onClick={()=>send(scenario.label)}><span className="consultant-choice-number">0{i+1}</span>{scenario.label}<ArrowUpRight size={17}/></button>)}</div><p className="consultant-hint">Можно начать с примера или написать свой вопрос ниже.</p></>}
        <div className="consultant-transcript" role="log" aria-label="Диалог с консультантом" aria-live="polite" aria-relevant="additions text">
          {turns.map((turn,index)=>turn.role==='user'?<div className="consultant-request" key={index}><span className="consultant-speaker">Вы</span>{turn.content}</div>:<section className="consultant-answer" key={index}><span className="consultant-source">КОНСУЛЬТАНТ · YANDEXGPT</span><p className="consultant-answer-text">{turn.content}</p>{!!turn.products?.length&&<div className="consultant-products">{turn.products.map(p=><article key={p.id} className="consultant-product"><button className="consultant-product-image" onClick={()=>onSelect(p.id)} aria-label={'Открыть '+p.name}><img src={p.image} alt={p.name} width="112" height="100"/></button><div><small>{p.category} · {p.inStock?'В наличии':'На заказ'}</small><button className="consultant-product-name" onClick={()=>onSelect(p.id)}>{p.name}</button><strong>{money(p.price)}</strong></div><button className="consultant-add" aria-label={(added.includes(p.id)?'Ещё один в корзину: ':'В корзину: ')+p.name} onClick={()=>{onAdd(p.id);setAdded(v=>[...v,p.id]);}}>{added.includes(p.id)?<Check size={17}/>:<Plus size={17}/>}</button></article>)}</div>}</section>)}
        </div>
        {busy&&<div className="consultant-typing" role="status"><LoaderCircle size={17}/>Консультант готовит ответ…</div>}
        {error&&<p className="consultant-error" role="alert">{error}</p>}
        {pending&&!busy&&<button className="consultant-retry" onClick={()=>send(turns.at(-1)!.content,true)}><RotateCcw size={14}/>Повторить отправку</button>}
      </div>
      <form className="consultant-composer" onSubmit={e=>{e.preventDefault();void send(draft);}}>
        <label htmlFor="consultant-message">Ваш вопрос о мебели</label>
        <div className="consultant-input-row"><textarea ref={input} id="consultant-message" rows={2} maxLength={CHAT_INPUT_LIMIT} value={draft} readOnly={busy} placeholder="Например: нужен дубовый стол на 6 человек…" onChange={e=>{onSession({...session,draft:e.target.value});if(error&&!pending)setError('');}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send(draft);}}}/><button type="submit" disabled={busy||!draft.trim()} aria-label="Отправить сообщение">{busy?<LoaderCircle size={20}/>:<ArrowUp size={21}/>}</button></div>
        <p className="consultant-privacy">Не вводите личные данные. Сообщения передаются YandexGPT для ответа; история — только в памяти этой страницы, до обновления.</p>
      </form>
      <footer className="consultant-footer"><Sparkles size={14}/><span>Цены в карточках — из каталога. Индивидуальный расчёт подтвердит менеджер. Заявки в демо не отправляются.</span></footer>
    </aside>
  </div>;
}
