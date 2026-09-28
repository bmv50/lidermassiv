'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Heart, Search, ShoppingBag, X} from 'lucide-react';
import type seed from './data/products.json';

type Product = typeof seed[number];
type Details = {images: string[]; specifications: {name: string; value: string}[]};
const detailCache = new Map<string, Details>();
const selection = ['84027', '82715', '83719', '83892', '82976', '83718'];
const money = (value: number) => new Intl.NumberFormat('ru-RU').format(value) + ' ₽';

function dimensions(details: Details | null) {
  if (!details) return '';
  const find = (name: string) => details.specifications.find(item => item.name.toLowerCase().startsWith(name))?.value;
  const width = find('ширина'), depth = find('глубина') || find('длина'), height = find('высота');
  return width && depth && height ? `${width} × ${depth} × ${height} см` : '';
}

function CollectionCard({product, saved, onFavorite, onSelect, onAdd}: {
  product: Product; saved: boolean; onFavorite: () => void;
  onSelect: () => void; onAdd: () => Promise<void>;
}) {
  const card = useRef<HTMLElement>(null);
  const touch = useRef<{x: number; y: number} | null>(null);
  const [details, setDetails] = useState<Details | null>(detailCache.get(product.id) || null);
  const [photo, setPhoto] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const [readyImage, setReadyImage] = useState('');
  useEffect(() => {
    if (detailCache.has(product.id)) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      fetch(`/product-details/${encodeURIComponent(product.id)}.json`, {signal: controller.signal})
        .then(async response => response.ok ? await response.json() as Details : null)
        .then(data => {if (data && !controller.signal.aborted) {detailCache.set(product.id, data); setDetails(data);}})
        .catch(() => {});
    }, {rootMargin: '350px'});
    if (card.current) observer.observe(card.current);
    return () => {observer.disconnect(); controller.abort();};
  }, [product.id]);
  // The first gallery image usually duplicates the cover; use the next actual angle.
  const alternative = details?.images.find((src, index) => index > 0 && src !== product.image && !failed.includes(src));
  const second = Boolean(alternative) && readyImage === alternative && (hovered || photo === 1);
  const size = dimensions(details);
  const finalPrice = Math.round(product.price * (1 - product.discount / 100));
  function move() {setHovered(false); setPhoto(value => value === 0 ? 1 : 0);}

  return <article ref={card} className="collection-card">
    <div className={'collection-photo' + (second ? ' showing-alternate' : '')}
      onPointerEnter={event => {if (event.pointerType === 'mouse') setHovered(true);}}
      onPointerLeave={() => setHovered(false)}>
      <button className="collection-photo-open" onClick={onSelect} aria-label={`Открыть: ${product.name}`}
        onTouchStart={event => {touch.current = {x: event.touches[0].clientX, y: event.touches[0].clientY};}}
        onTouchEnd={event => {
          if (!touch.current) return;
          const dx = event.changedTouches[0].clientX - touch.current.x;
          const dy = event.changedTouches[0].clientY - touch.current.y;
          if (alternative && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {event.preventDefault(); move();}
          touch.current = null;
        }} onTouchCancel={() => {touch.current = null;}}>
        <img className="collection-cover" src={product.image} alt={product.name} loading="lazy" decoding="async"/>
        {alternative && <img className="collection-alternate" src={alternative} alt={`${product.name} — другой ракурс`} loading="lazy" decoding="async" onLoad={() => setReadyImage(alternative)} onError={() => setFailed(values => [...values, alternative])}/>}
        <span className="collection-photo-link">Рассмотреть <ArrowUpRight size={16}/></span>
      </button>
      {product.discount > 0 && <span className="collection-discount">−{product.discount}%</span>}
      <button className={'collection-favorite' + (saved ? ' is-saved' : '')} aria-label={`${saved ? 'Убрать из избранного' : 'В избранное'}: ${product.name}`} aria-pressed={saved} onClick={onFavorite}><Heart size={19} fill={saved ? 'currentColor' : 'none'}/></button>
      {alternative && <div className="collection-photo-controls">
        <button onClick={move} aria-label={`Предыдущее фото: ${product.name}`}><ChevronLeft size={16}/></button>
        <span aria-live="polite">{second ? '02' : '01'} / 02</span>
        <button onClick={move} aria-label={`Следующее фото: ${product.name}`}><ChevronRight size={16}/></button>
      </div>}
    </div>
    <div className="collection-card-meta"><span>{product.category}</span><span className={product.stock ? 'is-available' : ''}>{product.stock ? 'В наличии' : 'На заказ'}</span></div>
    <h3><button onClick={onSelect}>{product.name}</button></h3>
    <p className="collection-dimensions" title={size ? 'Ширина × глубина (длина) × высота' : undefined}>{size || 'Размеры и отделка — в карточке'}</p>
    <div className="collection-card-bottom"><div className="collection-price"><strong>{money(finalPrice)}</strong>{product.discount > 0 && <del>{money(product.price)}</del>}</div>
      <button className="collection-add" disabled={adding} aria-label={`В корзину: ${product.name}`} onClick={async () => {setAdding(true); try {await onAdd();} finally {setAdding(false);}}}><span>{adding ? 'Добавляем' : 'В корзину'}</span><ShoppingBag size={17}/></button>
    </div>
  </article>;
}

export default function HomeCollection({products, categories, category, onCategory, query, onQuery, showSearch, onSearch, favorites, favOnly, onFavorite, onSelect, onAdd, onReset}: {
  products: Product[]; categories: string[]; category: string; onCategory: (category: string) => void;
  query: string; onQuery: (query: string) => void; showSearch: boolean; onSearch: (show: boolean) => void;
  favorites: string[]; favOnly: boolean; onFavorite: (id: string) => void;
  onSelect: (product: Product) => void; onAdd: (product: Product) => Promise<void>; onReset: () => void;
}) {
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {if (showSearch) search.current?.focus();}, [showSearch]);
  const ranked = [...products].sort((a, b) => {
    const rank = (id: string) => selection.includes(id) ? selection.indexOf(id) : selection.length;
    return rank(a.id) - rank(b.id);
  });
  const params = new URLSearchParams();
  if (category !== 'Все товары') params.set('category', category);
  if (query) params.set('q', query);
  if (favOnly) params.set('favorites', '1');
  const catalogLink = '/catalog' + (params.size ? '?' + params.toString() : '');

  return <section className="section home-collection" id="catalog" aria-labelledby="home-collection-title">
    <div className="collection-heading"><div><span className="eyebrow">ИЗБРАННЫЕ МОДЕЛИ / ЛИДЕР МАССИВ</span><h2 id="home-collection-title">{favOnly ? 'Ваше избранное' : <>Предметы <em>с характером.</em></>}</h2></div><p>Естественная красота дуба. <br/>Формы, к которым хочется прикоснуться.</p></div>
    <div className="collection-navigation"><div className="collection-tabs" aria-label="Категории мебели">{categories.slice(0, 5).map((item, index) => <button key={item} className={category === item ? 'is-active' : ''} aria-pressed={category === item} onClick={() => onCategory(item)}>{index === 0 ? 'Подборка' : item}</button>)}<select aria-label="Другие категории" value={categories.slice(5).includes(category) ? category : ''} onChange={event => onCategory(event.target.value)}><option value="" disabled>Ещё категории</option>{categories.slice(5).map(item => <option key={item}>{item}</option>)}</select></div><button className="collection-search-toggle" aria-label={showSearch ? 'Закрыть поиск' : 'Найти мебель'} aria-expanded={showSearch} aria-controls="collection-search" onClick={() => {onSearch(!showSearch); if (showSearch) onQuery('');}}>{showSearch ? <X size={18}/> : <Search size={18}/>}<span>Поиск</span></button></div>
    {showSearch && <div className="collection-search" id="collection-search"><label htmlFor="search">Найти свою мебель</label><input ref={search} id="search" type="search" placeholder="Название модели…" value={query} onChange={event => onQuery(event.target.value)}/></div>}
    <div className="collection-grid">{ranked.slice(0, 6).map(product => <CollectionCard key={product.id} product={product} saved={favorites.includes(product.id)} onFavorite={() => onFavorite(product.id)} onSelect={() => onSelect(product)} onAdd={() => onAdd(product)}/>)}</div>
    {products.length === 0 && <div className="empty">{favOnly ? 'Здесь появятся сохранённые вами модели.' : 'По вашему запросу пока ничего не найдено.'}<button onClick={onReset}>Показать подборку</button></div>}
    <div className="collection-footer"><p><span>{String(Math.min(6, products.length)).padStart(2, '0')}</span> {favOnly ? 'избранных моделей' : 'моделей в подборке'}<small>Найдите ту, что станет вашей.</small></p><a className="collection-catalog-link" href={catalogLink}>{category === 'Все товары' && !favOnly && !query ? 'Весь каталог' : 'Все результаты'} <ArrowRight size={20}/></a></div>
  </section>;
}
