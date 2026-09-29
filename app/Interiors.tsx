'use client';
import {useState} from 'react';
import {ArrowUpRight,Plus} from 'lucide-react';
import type seed from './data/products.json';
type Product=typeof seed[number];
const rooms=[
 {id:'82928',title:'Тишина утра',label:'Современная спальня',image:'/gallery/5b7fa6809bf4a44f7a2e73bd.webp',copy:'Выразительная фактура дерева, чистые линии и мягкий утренний свет. Пространство, в котором легко замедлиться.',x:48,y:63},
 {id:'82594',title:'Светлая классика',label:'Гостиная',image:'/gallery/730bc665d4d160b7993eb8e5.webp',copy:'Светлая отделка и стройные пропорции. Продуманная композиция для книг, любимых предметов и вечеров дома.',x:49,y:72},
 {id:'82929',title:'Семейная история',label:'Классическая спальня',image:'/gallery/dc15d39c2afe41550053f63d.webp',copy:'Глубокий оттенок дерева и благородные линии. Мебель, вокруг которой складывается свой, особенный мир.',x:43,y:67},
];
export default function Interiors({products,onSelect}:{products:Product[];onSelect:(product:Product)=>void}){
 const [selected,setSelected]=useState('82928');
 const available=rooms.filter(room=>products.some(p=>p.id===room.id&&p.active));
 const room=available.find(r=>r.id===selected)||available[0];
 if(!room)return null;
 const product=products.find(p=>p.id===room.id)!;
 return <section className="section interiors" id="interiors" aria-labelledby="interiors-title">
  <div className="section-heading"><div><span className="eyebrow">ВДОХНОВЕНИЕ ДЛЯ ВАШЕГО ДОМА</span><h2 id="interiors-title">Представьте это <em>у себя.</em></h2></div><p>Мебель из каталога — в готовых интерьерах.</p></div>
  <div className="room-tabs" aria-label="Выберите интерьер">{available.map((r,i)=><button key={r.id} aria-pressed={room.id===r.id} onClick={()=>setSelected(r.id)}><span>0{i+1}</span>{r.label}</button>)}</div>
  <div className="room-layout"><div className="room-photo" key={room.id}><img src={room.image} alt={`${product.name} в интерьере`} loading="lazy" width="1100" height="730"/><button className="room-hotspot" style={{left:room.x+'%',top:room.y+'%'}} onClick={()=>onSelect(product)} aria-label={`Посмотреть комплект: ${product.name}`}><Plus size={21}/><span>Посмотреть комплект</span></button></div>
  <div className="room-copy"><span className="eyebrow">{room.label}</span><h3>{room.title}</h3><p>{room.copy}</p><div className="room-product"><span>В ЭТОМ ИНТЕРЬЕРЕ</span><h4>{product.name}</h4><strong>{new Intl.NumberFormat('ru-RU').format(Math.round(product.price*(1-product.discount/100)))} ₽</strong><button onClick={()=>onSelect(product)}>Рассмотреть комплект <ArrowUpRight size={19}/></button><small>Состав и отделку комплекта уточним при заказе.</small></div></div></div>
 </section>
}
