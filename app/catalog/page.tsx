import Store from '../Store';
import type {Metadata} from 'next';
import {productMetadata} from '../lib/product-metadata';

export async function generateMetadata({searchParams}: {searchParams: Promise<{product?: string}>}): Promise<Metadata> {
  return productMetadata((await searchParams).product, '/catalog', 'Каталог мебели из массива дуба — Лидер Массив');
}

export default function Page(){return <Store catalog/>}
