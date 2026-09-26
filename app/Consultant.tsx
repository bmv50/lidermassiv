'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check,ChevronLeft,LoaderCircle,Plus,Sparkles,X} from 'lucide-react';
import {scenarios,type Scenario,type ConsultantReply} from './lib/consultant';
import './consultant.css';
const money=(value:number)=>new Intl.NumberFormat('ru-RU').format(value)+' ₽';
export default function Consultant({onClose,onSelect,onAdd}:{onClose:()=>void;onSelect:(id:string)=>void;onAdd:(id:string)=>void}) {
  const [reply,setReply]=useState<ConsultantReply|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [selected,setSelected]=useState<Scenario|null>(null),[added,setAdded]=useState<string[]>([]);
  const panel=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null),body=useRef<HTMLDivElement>(null),controller=useRef<AbortController|null>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';close.current?.focus();return()=>{controller.current?.abort();document.body.style.overflow=overflow;previous?.focus();}},[]);
  useEffect(()=>{body.current?.scrollTo({top:0,behavior:'smooth'});},[reply,busy]);
  async function choose(scenario:Scenario) {
    controller.current?.abort();const next=new AbortController();controller.current=next;
    setSelected(scenario);setBusy(true);setError('');setReply(null);setAdded([]);close.current?.focus();
    try {
      const response=await fetch('/api/consultant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario}),signal:next.signal});
      const value=await response.json() as ConsultantReply & {error?:string};if(!response.ok)throw Error(value.error||'Не удалось получить ответ.');
      if(!next.signal.aborted)setReply(value);
    } catch(e) {if(!next.signal.aborted)setError(e instanceof Error?e.message:'Не удалось получить ответ.');}
    finally {if(!next.signal.aborted)setBusy(false);}
  }
  function reset(){controller.current?.abort();setBusy(false);setError('');setReply(null);setSelected(null);close.current?.focus();}
  return <div className="consultant-shade" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <aside className="consultant" role="dialog" aria-modal="true" aria-labelledby="consultant-title" ref={panel} onKeyDown={e=>{
      if(e.key==='Escape'){e.stopPropagation();onClose();}
      if(e.key==='Tab'){const controls=panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]');if(!controls?.length)return;const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    }}>
      <header className="consultant-header"><span className="consultant-mark"><Sparkles size={23}/></span><div><small>ЛИДЕР МАССИВ · КОНСУЛЬТАНТ</small><h2 id="consultant-title">Начнём с вашей идеи</h2></div><button ref={close} className="consultant-close" onClick={onClose} aria-label="Закрыть консультанта"><X size={21}/></button></header>
      <div className="consultant-body" ref={body}>
        <div className="consultant-demo"><span/>Демонстрация · без ввода личных данных</div>
        {!selected?<><h3 className="consultant-welcome">Мебель, которая<br/><em>подойдёт именно вам.</em></h3><p className="consultant-intro">Попробуйте подбор по каталогу или посмотрите, с чего начинается индивидуальный проект.</p><div className="consultant-choices">{Object.entries(scenarios).map(([id,scenario],i)=><button key={id} onClick={()=>choose(id as Scenario)}><span className="consultant-choice-number">0{i+1}</span>{scenario.label}<ArrowUpRight size={18}/></button>)}</div><p className="consultant-hint">Выберите готовый пример. Свободный диалог появится в полной версии.</p></>:
          <><button className="consultant-back" onClick={reset}><ChevronLeft size={16}/>Другой вопрос</button><div className="consultant-request">{scenarios[selected].label}</div>
          {busy&&<div className="consultant-loading" role="status"><LoaderCircle size={23}/><strong>Знакомлюсь с каталогом…</strong><span>Подбираю предметы для вашего примера.</span></div>}
          {error&&<div className="consultant-error" role="alert"><p>{error}</p><button onClick={()=>choose(selected)}>Попробовать ещё раз</button></div>}
          {reply&&<section className="consultant-answer" aria-live="polite"><span className="consultant-source">{reply.source==='ai'?'Подбор с помощью ИИ':'Справочный подбор · без ИИ'}</span><h3>{reply.heading}</h3><p>{reply.text}</p>
            <div className="consultant-products">{reply.products.map(p=><article key={p.id} className="consultant-product"><button className="consultant-product-image" onClick={()=>onSelect(p.id)} aria-label={'Открыть '+p.name}><img src={p.image} alt={p.name} width="112" height="100"/></button><div><small>{p.category} · {p.inStock?'В наличии':'На заказ'}</small><button className="consultant-product-name" onClick={()=>onSelect(p.id)}>{p.name}</button><strong>{money(p.price)}</strong></div><button className="consultant-add" aria-label={(added.includes(p.id)?'Ещё один в корзину: ':'В корзину: ')+p.name} onClick={()=>{onAdd(p.id);setAdded(v=>[...v,p.id]);}}>{added.includes(p.id)?<Check size={17}/>:<Plus size={17}/>}</button></article>)}</div>
            {!reply.products.length&&selected!=='delivery'&&<p className="consultant-hint">Для этого примера сейчас нет подходящих товаров. Посмотрите другие категории в каталоге.</p>}
            {reply.brief&&<div className="consultant-brief"><small>ПРИМЕР ЗАДАНИЯ НА ИЗГОТОВЛЕНИЕ</small>{reply.brief.map(line=><p key={line}>{line}</p>)}</div>}
            {!!reply.questions.length&&<div className="consultant-next"><h4>Что уточним на следующем шаге</h4>{reply.questions.map(q=><p key={q}><span/> {q}</p>)}<small>В полной версии ответы помогут подготовить проект для менеджера.</small></div>}
            {selected==='delivery'&&<a className="consultant-contact" href="/#contacts" onClick={onClose}>Адреса и контакты магазина <ArrowUpRight size={17}/></a>}
          </section>}</>}
      </div><footer className="consultant-footer"><Sparkles size={14}/><span>Цены — из каталога. Индивидуальные проекты — с расчётом менеджера.</span></footer>
    </aside>
  </div>;
}
