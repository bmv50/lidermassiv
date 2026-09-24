import type { Metadata } from 'next';
import seed from '../data/products.json';
import { db } from './shop';

type Product = typeof seed[number];
const siteOrigin = 'https://demo.lider-massiv.ru';
const socialImage = '/images/social-preview.jpg';
const defaultDescription = 'Мебель из массива дуба. Каталог, индивидуальное изготовление и доставка по России.';

export async function productMetadata(
  productId: string | undefined,
  basePath: '/' | '/catalog',
  fallbackTitle: string,
): Promise<Metadata> {
  let product: Product | undefined;

  if (productId && productId.length <= 100) {
    try {
      const row = await db().prepare('SELECT payload FROM products WHERE id = ?')
        .bind(productId).first<{ payload: string }>();
      if (row) product = JSON.parse(row.payload) as Product;
    } catch {
      // A fresh installation may not have a local D1 database yet.
    }
    product ??= seed.find(item => item.id === productId);
  }

  if (!product?.active) {
    return {
      title: fallbackTitle,
      alternates: { canonical: basePath },
      openGraph: {
        type: 'website',
        locale: 'ru_RU',
        siteName: 'Лидер Массив',
        url: new URL(basePath, siteOrigin).toString(),
        title: fallbackTitle,
        description: defaultDescription,
        images: [{ url: socialImage, width: 1200, height: 630, alt: 'Лидер Массив — мебель из массива дуба' }],
      },
      twitter: { card: 'summary_large_image', title: fallbackTitle, description: defaultDescription, images: [socialImage] },
    };
  }

  const canonical = `${basePath}?product=${encodeURIComponent(product.id)}`;
  const title = `${product.name} — Лидер Массив`;
  const description = product.description.slice(0, 180);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      locale: 'ru_RU',
      siteName: 'Лидер Массив',
      url: new URL(canonical, siteOrigin).toString(),
      title,
      description,
      images: [{ url: socialImage, width: 1200, height: 630, alt: 'Лидер Массив — мебель из массива дуба' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [socialImage] },
  };
}
