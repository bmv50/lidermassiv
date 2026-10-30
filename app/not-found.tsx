export default function NotFound() {
  return <main className="not-found">
    <a className="not-found-brand" href="/">ЛИДЕР МАССИВ <span>ПРИРОДА В ВАШЕМ ДОМЕ</span></a>
    <div className="not-found-content">
      <span className="eyebrow">СТРАНИЦА НЕ НАЙДЕНА · 404</span>
      <h1>Похоже, вы свернули с пути.</h1>
      <p>Возможно, адрес изменился. Вернитесь к изделиям из массива дуба или начните с главной страницы.</p>
      <div className="not-found-actions"><a href="/catalog">Открыть каталог <span aria-hidden="true">↗</span></a><a href="/">На главную <span aria-hidden="true">→</span></a></div>
    </div>
  </main>;
}
