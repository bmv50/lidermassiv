'use client';

import {ArrowUpRight} from 'lucide-react';
import type seed from './data/products.json';
type Product = typeof seed[number];
const rooms = [
  {category: 'Столы', id: '84027', subtitle: 'Место для встреч'},
  {category: 'Комоды', id: '82715', subtitle: 'Красота порядка'},
  {category: 'Кровати', id: '82804', subtitle: 'Ваше личное пространство', image: '/gallery/2c0aa08e2a960b66dba7f2c1.webp'},
  {category: 'Шкафы', id: '83719', subtitle: 'Для любимых вещей'},
];

export default function HomeCategories({products, onCategory}: {products: Product[]; onCategory: (category: string) => void}) {
  return <section className="section category-editorial" aria-labelledby="category-editorial-title">
    <div className="section-heading"><div><span className="eyebrow">ДЛЯ КАЖДОЙ КОМНАТЫ</span><h2 id="category-editorial-title">Место для <em>вашей жизни.</em></h2></div><a href="/catalog">Весь каталог <ArrowUpRight size={18}/></a></div>
    <div className="category-editorial-grid">{rooms.map((room, index) => {
      const product = products.find(item => item.id === room.id && item.active) || products.find(item => item.category === room.category && item.active);
      const image = product?.id === room.id && room.image && product.image === `/images/${room.id}.jpg` ? room.image : product?.image;
      return <button className="category-editorial-card" key={room.category} onClick={() => onCategory(room.category)}>
        <span className="category-editorial-photo"><span className="category-editorial-number">0{index + 1}</span>{image && <img src={image} alt={room.category} loading="lazy" decoding="async"/>}<span className="category-editorial-arrow"><ArrowUpRight size={20}/></span></span>
        <span className="category-editorial-name">{room.category}</span><span className="category-editorial-subtitle">{room.subtitle}</span>
      </button>;
    })}</div>
    <div className="category-editorial-more"><span>Другие предметы для вашего дома</span>{['Стеллажи', 'Тумбы', 'Буфеты', 'Витрины'].map(category => <button key={category} onClick={() => onCategory(category)}>{category}<ArrowUpRight size={14}/></button>)}</div>
  </section>;
}
