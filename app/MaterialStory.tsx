'use client';

import {ArrowUpRight} from 'lucide-react';
import type seed from './data/products.json';
type Product = typeof seed[number];

export default function MaterialStory({products, onSelect}: {products: Product[]; onSelect: (product: Product) => void}) {
  const product = products.find(item => item.id === '84027' && item.active);
  if (!product) return null;
  return <section className="material-story" aria-labelledby="material-story-title">
    <div className="section material-story-layout"><div className="material-story-copy"><span className="eyebrow">МАССИВ ДУБА / ХАРАКТЕР В ДЕТАЛЯХ</span><h2 id="material-story-title">Красота начинается<br/>с <em>прикосновения.</em></h2><p>Рисунок волокон, рельеф поверхности, плавный переход от столешницы к основанию. Дерево раскрывается в деталях, которые хочется рассмотреть ближе.</p><button onClick={() => onSelect(product)}>Рассмотреть модель <ArrowUpRight size={18}/></button><small>{product.name}</small></div>
    <figure className="material-story-photo"><img src="/gallery/83b342f5b6b3775dff4e8ee2.webp" alt={`Фактура дуба и точёная опора — ${product.name}`} loading="lazy" decoding="async" width="1000" height="750"/><figcaption>Естественный рисунок. Неповторимый характер.</figcaption></figure></div>
  </section>;
}
